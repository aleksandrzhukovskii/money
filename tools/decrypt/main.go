// Command money-decrypt turns a Money Tracker backup into a plain SQLite file.
//
// The app has no "export plain" button on purpose: unencrypted financial data
// should only ever land on a machine you control, not in a browser's download
// folder that syncs to a cloud drive. Run this there instead.
//
// Backup format, as written by src/lib/crypto.ts:
//
//	salt (16 bytes) || nonce (12 bytes) || AES-256-GCM ciphertext+tag
//	key = PBKDF2-HMAC-SHA256(password, salt, 100000) -> 32 bytes
package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/pbkdf2"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
)

const (
	saltLen           = 16
	nonceLen          = 12
	gcmTagLen         = 16
	keyLen            = 32
	defaultIterations = 100_000
)

var sqliteMagic = []byte("SQLite format 3\x00")

func deriveKey(password string, salt []byte, iterations int) ([]byte, error) {
	return pbkdf2.Key(sha256.New, password, salt, iterations, keyLen)
}

// decryptBlob reverses src/lib/crypto.ts encrypt().
func decryptBlob(blob []byte, password string, iterations int) ([]byte, error) {
	if len(blob) < saltLen+nonceLen+gcmTagLen {
		return nil, fmt.Errorf("input is %d bytes, too short to be a backup", len(blob))
	}
	salt := blob[:saltLen]
	nonce := blob[saltLen : saltLen+nonceLen]
	ciphertext := blob[saltLen+nonceLen:]

	key, err := deriveKey(password, salt, iterations)
	if err != nil {
		return nil, fmt.Errorf("deriving key: %w", err)
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("creating cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("creating GCM: %w", err)
	}
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, errors.New("decryption failed: wrong password, wrong iteration count, or corrupt file")
	}
	return plaintext, nil
}

// readPassword prefers the environment so the password never reaches shell history.
func readPassword() (string, error) {
	if pw, ok := os.LookupEnv("MONEY_PASSWORD"); ok && pw != "" {
		return pw, nil
	}
	info, err := os.Stdin.Stat()
	if err == nil && info.Mode()&os.ModeCharDevice != 0 {
		fmt.Fprint(os.Stderr, "Password (will echo — use MONEY_PASSWORD to avoid): ")
	}
	line, err := io.ReadAll(os.Stdin)
	if err != nil {
		return "", fmt.Errorf("reading password: %w", err)
	}
	pw := strings.TrimRight(string(line), "\r\n")
	if pw == "" {
		return "", errors.New("no password supplied")
	}
	return pw, nil
}

func defaultOutput(in string, isBase64 bool) string {
	if isBase64 {
		return "-" // credentials blob decrypts to JSON; print it
	}
	return strings.TrimSuffix(in, ".enc") + ".db"
}

func run() error {
	out := flag.String("out", "", `output file, "-" for stdout (default: input with .db extension)`)
	iterations := flag.Int("iter", defaultIterations, "PBKDF2 iteration count used to encrypt the file")
	isBase64 := flag.Bool("base64", false, "input is base64 (the localStorage credentials blob)")
	force := flag.Bool("f", false, "overwrite the output file if it exists")
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "Usage: money-decrypt [flags] <file.enc>\n\n"+
			"Decrypts a Money Tracker backup into a plain SQLite database.\n"+
			"The password is read from $MONEY_PASSWORD, or stdin if unset.\n\n"+
			"Examples:\n"+
			"  MONEY_PASSWORD=... money-decrypt money-tracker.enc\n"+
			"  read -rs PW && echo \"$PW\" | money-decrypt -out db.sqlite money-tracker.enc\n"+
			"  money-decrypt -base64 credentials.txt    # recover the GitHub token\n\nFlags:\n")
		flag.PrintDefaults()
	}
	flag.Parse()

	if flag.NArg() != 1 {
		flag.Usage()
		return errors.New("expected exactly one input file")
	}
	input := flag.Arg(0)

	blob, err := os.ReadFile(input)
	if err != nil {
		return fmt.Errorf("reading %s: %w", input, err)
	}
	if *isBase64 {
		decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(blob)))
		if err != nil {
			return fmt.Errorf("decoding base64 input: %w", err)
		}
		blob = decoded
	}

	password, err := readPassword()
	if err != nil {
		return err
	}

	plaintext, err := decryptBlob(blob, password, *iterations)
	if err != nil {
		return err
	}

	target := *out
	if target == "" {
		target = defaultOutput(input, *isBase64)
	}
	if target == "-" {
		_, err := os.Stdout.Write(plaintext)
		return err
	}
	if !*force {
		if _, err := os.Stat(target); err == nil {
			return fmt.Errorf("%s already exists (use -f to overwrite)", target)
		}
	}
	if err := os.WriteFile(target, plaintext, 0o600); err != nil {
		return fmt.Errorf("writing %s: %w", target, err)
	}

	kind := "data"
	if len(plaintext) >= len(sqliteMagic) && string(plaintext[:len(sqliteMagic)]) == string(sqliteMagic) {
		kind = "SQLite database"
	}
	fmt.Fprintf(os.Stderr, "Wrote %d bytes of %s to %s\n", len(plaintext), kind, target)
	return nil
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}
