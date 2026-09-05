package main

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

// migrateOptions is everything -migrate needs. Kept separate from flag parsing
// so the flow can be tested against a fake GitHub.
type migrateOptions struct {
	client     *ghClient
	password   string
	candidates []int
	backupDir  string
	dryRun     bool
	force      bool
	out        io.Writer
}

// migrate fetches the synced blob, re-encrypts it with the parameters the
// current app build expects, and writes it back.
//
// The order matters: a local backup is written before anything is uploaded, and
// the re-encrypted blob is decrypted again and compared before it replaces the
// only copy of the database.
func migrate(opts migrateOptions) error {
	log := func(format string, args ...any) {
		fmt.Fprintf(opts.out, format+"\n", args...)
	}

	log("Fetching %s from %s...", opts.client.path, opts.client.repo)
	blob, sha, ok, err := opts.client.getFile()
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("%s does not exist in %s — nothing to migrate", opts.client.path, opts.client.repo)
	}
	log("Fetched %d bytes (sha %s)", len(blob), shortSHA(sha))

	backupPath, err := writeBackup(opts.backupDir, blob)
	if err != nil {
		return fmt.Errorf("writing local backup: %w", err)
	}
	log("Backed up the original to %s", backupPath)

	plaintext, iterations, err := decryptBlob(blob, opts.password, opts.candidates)
	if err != nil {
		return err
	}
	log("Decrypted %s encrypted at %d iterations", describe(plaintext), iterations)

	if iterations == currentIterations && !opts.force {
		log("Already at %d iterations — nothing to do (use -f to re-encrypt anyway)", currentIterations)
		return nil
	}

	converted, err := encryptBlob(plaintext, opts.password, currentIterations)
	if err != nil {
		return err
	}

	// Never upload something we haven't proved we can read back.
	verified, verifiedIterations, err := decryptBlob(converted, opts.password, []int{currentIterations})
	if err != nil {
		return fmt.Errorf("re-encrypted blob failed verification: %w", err)
	}
	if !bytes.Equal(verified, plaintext) {
		return errors.New("re-encrypted blob did not round-trip to the same contents; nothing was uploaded")
	}
	log("Re-encrypted at %d iterations and verified the round trip", verifiedIterations)

	if opts.dryRun {
		log("Dry run — not uploading. The original is unchanged.")
		return nil
	}

	message := fmt.Sprintf("migrate: re-encrypt at %d PBKDF2 iterations", currentIterations)
	newSHA, err := opts.client.putFile(converted, sha, message)
	if err != nil {
		return fmt.Errorf("%w\n(nothing was lost — the original is still at %s)", err, backupPath)
	}
	log("Uploaded %d bytes (sha %s)", len(converted), shortSHA(newSHA))
	log("")
	log("Done. On each device: Settings -> Logout, or \"Use different account\" on the")
	log("login screen, then log in again. The wipe is required — the stored credentials")
	log("are still encrypted with the old parameters.")
	return nil
}

func shortSHA(sha string) string {
	if len(sha) > 8 {
		return sha[:8]
	}
	return sha
}

func writeBackup(dir string, blob []byte) (string, error) {
	if dir == "" {
		dir = "."
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	name := fmt.Sprintf("money-tracker-%s.enc.backup", time.Now().UTC().Format("20060102T150405Z"))
	path := filepath.Join(dir, name)
	if _, err := os.Stat(path); err == nil {
		return "", fmt.Errorf("%s already exists", path)
	}
	if err := os.WriteFile(path, blob, 0o600); err != nil {
		return "", err
	}
	return path, nil
}
