// Command money-decrypt reads Money Tracker backups: it decrypts one to a plain
// SQLite file, or re-encrypts one with the app's current parameters.
//
// The app has no "export plain" button on purpose: unencrypted financial data
// should only ever land on a machine you control, not in a browser's download
// folder that syncs to a cloud drive. Run this there instead.
//
// Envelope layout, matching src/lib/crypto.ts:
//
//	salt(16) | nonce(12) | AES-256-GCM ciphertext+tag
//	key = PBKDF2-HMAC-SHA256(password, salt, iterations) -> 32 bytes
//
// There is no version header, so a file doesn't say which iteration count made
// it. That's fine: GCM authenticates, so the tool simply tries every parameter
// set the app has ever shipped and reports which one opened the file. Wrong
// guesses fail cleanly rather than producing garbage.
//
// This is also the migration path. When the app's parameters change, existing
// blobs become unreadable to it, so convert them out of band first:
//
//	money-decrypt -convert -out money-tracker.enc money-tracker.enc.orig
//
// Or, with -migrate, it does the whole round trip against the private repo:
// fetch, back up locally, re-encrypt, verify, upload.
package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/pbkdf2"
	"crypto/rand"
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
	saltLen   = 16
	nonceLen  = 12
	gcmTagLen = 16
	keyLen    = 32

	// What the app writes today. Keep in sync with PBKDF2_ITERATIONS in src/lib/crypto.ts.
	currentIterations = 600_000
	// What it wrote before that. Kept so old exports stay readable forever.
	legacyIterations = 100_000
)

// knownIterations is tried in order. Put the current value first so the common
// case costs one derivation.
var knownIterations = []int{currentIterations, legacyIterations}

var sqliteMagic = []byte("SQLite format 3\x00")

func aeadFor(password string, salt []byte, iterations int) (cipher.AEAD, error) {
	key, err := pbkdf2.Key(sha256.New, password, salt, iterations, keyLen)
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
	return gcm, nil
}

// decryptWith attempts a single parameter set. A failure here is ambiguous
// between "wrong password" and "wrong iteration count", which is why the caller
// tries them all before giving up.
func decryptWith(blob []byte, password string, iterations int) ([]byte, error) {
	if len(blob) < saltLen+nonceLen+gcmTagLen {
		return nil, fmt.Errorf("input is %d bytes, too short to be a backup", len(blob))
	}
	salt := blob[:saltLen]
	nonce := blob[saltLen : saltLen+nonceLen]
	ciphertext := blob[saltLen+nonceLen:]

	gcm, err := aeadFor(password, salt, iterations)
	if err != nil {
		return nil, err
	}
	return gcm.Open(nil, nonce, ciphertext, nil)
}

// decryptBlob tries every known parameter set and reports which one worked.
func decryptBlob(blob []byte, password string, candidates []int) ([]byte, int, error) {
	if len(blob) < saltLen+nonceLen+gcmTagLen {
		return nil, 0, fmt.Errorf("input is %d bytes, too short to be a backup", len(blob))
	}
	for _, iterations := range candidates {
		plaintext, err := decryptWith(blob, password, iterations)
		if err == nil {
			return plaintext, iterations, nil
		}
	}
	return nil, 0, fmt.Errorf("decryption failed with every known iteration count %v: wrong password or corrupt file", candidates)
}

func encryptBlob(plaintext []byte, password string, iterations int) ([]byte, error) {
	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return nil, fmt.Errorf("generating salt: %w", err)
	}
	nonce := make([]byte, nonceLen)
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("generating nonce: %w", err)
	}
	gcm, err := aeadFor(password, salt, iterations)
	if err != nil {
		return nil, err
	}

	out := make([]byte, 0, saltLen+nonceLen+len(plaintext)+gcmTagLen)
	out = append(out, salt...)
	out = append(out, nonce...)
	return gcm.Seal(out, nonce, plaintext, nil), nil
}

// readToken keeps the token out of argv, where any other process could read it.
func readToken(path string) (string, error) {
	if path != "" {
		raw, err := os.ReadFile(path)
		if err != nil {
			return "", fmt.Errorf("reading token file: %w", err)
		}
		if token := strings.TrimSpace(string(raw)); token != "" {
			return token, nil
		}
		return "", fmt.Errorf("%s is empty", path)
	}
	if token := strings.TrimSpace(os.Getenv("GITHUB_TOKEN")); token != "" {
		return token, nil
	}
	return "", errors.New("no GitHub token: set $GITHUB_TOKEN or pass -token-file")
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

func describe(plaintext []byte) string {
	if len(plaintext) >= len(sqliteMagic) && string(plaintext[:len(sqliteMagic)]) == string(sqliteMagic) {
		return "SQLite database"
	}
	return "data"
}

func run() error {
	out := flag.String("out", "", `output file, "-" for stdout (default: input with .db extension)`)
	doMigrate := flag.Bool("migrate", false, "fetch the synced file from GitHub, re-encrypt it with the current parameters and upload it back")
	repo := flag.String("repo", "", `GitHub repository as "owner/repo" (with -migrate)`)
	tokenFile := flag.String("token-file", "", "read the GitHub token from this file instead of $GITHUB_TOKEN")
	remotePath := flag.String("remote-path", defaultRemotePath, "path of the encrypted file inside the repository")
	dryRun := flag.Bool("dry-run", false, "with -migrate, do everything except the upload")
	backupDir := flag.String("backup-dir", ".", "where -migrate writes its copy of the original before uploading")
	convert := flag.Bool("convert", false, "re-encrypt with the app's current parameters instead of decrypting (requires -out)")
	iter := flag.Int("iter", 0, "only try this PBKDF2 iteration count instead of every known one")
	isBase64 := flag.Bool("base64", false, "input is base64 (the localStorage credentials blob)")
	force := flag.Bool("f", false, "overwrite the output file if it exists")
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "Usage: money-decrypt [flags] <file.enc>\n"+
			"       money-decrypt -migrate -repo owner/repo\n\n"+
			"Decrypts a Money Tracker backup to plain SQLite, or with -convert\n"+
			"re-encrypts it using the parameters the current app build expects.\n"+
			"With -migrate it does that against the synced file in the private repo:\n"+
			"fetch, back up locally, re-encrypt, verify, upload.\n"+
			"The iteration count is detected automatically.\n\n"+
			"The password is read from $MONEY_PASSWORD, or stdin if unset.\n"+
			"The GitHub token is read from $GITHUB_TOKEN or -token-file, never a flag,\n"+
			"so it stays out of shell history and the process list.\n\n"+
			"Examples:\n"+
			"  MONEY_PASSWORD=... money-decrypt money-tracker.enc\n"+
			"  read -rs PW && echo \"$PW\" | money-decrypt -out db.sqlite money-tracker.enc\n"+
			"  money-decrypt -convert -out new.enc money-tracker.enc   # convert a local file\n"+
			"  money-decrypt -migrate -repo me/money-data              # convert what's synced\n"+
			"  money-decrypt -base64 credentials.txt                   # recover the token\n\nFlags:\n")
		flag.PrintDefaults()
	}
	flag.Parse()

	candidates := knownIterations
	if *iter > 0 {
		candidates = []int{*iter}
	}

	if *doMigrate {
		if flag.NArg() != 0 {
			return errors.New("-migrate reads from GitHub; do not also pass a file")
		}
		if *repo == "" {
			return errors.New("-migrate needs -repo owner/repo")
		}
		token, err := readToken(*tokenFile)
		if err != nil {
			return err
		}
		client, err := newGHClient(*repo, token, *remotePath)
		if err != nil {
			return err
		}
		password, err := readPassword()
		if err != nil {
			return err
		}
		return migrate(migrateOptions{
			client:     client,
			password:   password,
			candidates: candidates,
			backupDir:  *backupDir,
			dryRun:     *dryRun,
			force:      *force,
			out:        os.Stderr,
		})
	}

	if flag.NArg() != 1 {
		flag.Usage()
		return errors.New("expected exactly one input file")
	}
	input := flag.Arg(0)

	if *convert && (*out == "" || *out == "-") {
		return errors.New("-convert needs an explicit -out file")
	}

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

	plaintext, iterations, err := decryptBlob(blob, password, candidates)
	if err != nil {
		return err
	}
	fmt.Fprintf(os.Stderr, "Read %s encrypted at %d iterations\n", describe(plaintext), iterations)

	payload := plaintext
	if *convert {
		if iterations == currentIterations {
			fmt.Fprintln(os.Stderr, "Note: input already uses the current parameters; re-encrypting anyway")
		}
		payload, err = encryptBlob(plaintext, password, currentIterations)
		if err != nil {
			return err
		}
	}

	target := *out
	if target == "" {
		target = defaultOutput(input, *isBase64)
	}
	if target == "-" {
		_, err := os.Stdout.Write(payload)
		return err
	}
	if !*force {
		if _, err := os.Stat(target); err == nil {
			return fmt.Errorf("%s already exists (use -f to overwrite)", target)
		}
	}
	if err := os.WriteFile(target, payload, 0o600); err != nil {
		return fmt.Errorf("writing %s: %w", target, err)
	}

	if *convert {
		fmt.Fprintf(os.Stderr, "Wrote %d bytes re-encrypted at %d iterations to %s\n", len(payload), currentIterations, target)
	} else {
		fmt.Fprintf(os.Stderr, "Wrote %d bytes of %s to %s\n", len(payload), describe(payload), target)
	}
	return nil
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}
