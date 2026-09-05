package main

import (
	"bytes"
	"encoding/base64"
	"testing"
)

// Both fixtures were produced by the browser implementation (src/lib/crypto.ts,
// compiled and run on Web Crypto), so these tests prove the Go tool reads what
// the app actually writes — at the current parameters and at the pre-migration
// ones. Neither carries a header; the tool works out which is which.
const (
	fixturePassword = "test-password-123"
	fixturePlainB64 = "U1FMaXRlIGZvcm1hdCAzAGhlbGxvIG1vbmV5IHRyYWNrZXIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="

	// PBKDF2 at 100k — what the app wrote before the migration.
	legacyBlobB64 = "n36Is14uiaBPgP/fDlRMVPXkdt90m1bmIRyQMWgbP2ZXct+vyaBE9/ASFK0w7ytqowW6aOPqodzxslHSNJS2mLTg9WkAoZkmIVDTdC3NEBqyWxGpDpzS67ONUPNTdcb+XQhIhQtAzmnGcZzl"
	// PBKDF2 at 600k — what it writes now.
	currentBlobB64 = "/C/Rf77X6tVEZDiXnl0kOF63GYqjv2pnMdKXjaWcpbIdWiuSrpa1r7IRRjJ4NQG8kxD9CLDy+fiOnyeOeP3jwRftYTMNqw8Wr0WkA+jV6TuVgkiqxFM7ndAVoWkbYWow10WIcqp5IHvcdcQj"
)

func mustDecode(t *testing.T, s string) []byte {
	t.Helper()
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		t.Fatalf("decoding fixture: %v", err)
	}
	return b
}

func TestDetectsIterationsAndDecrypts(t *testing.T) {
	want := mustDecode(t, fixturePlainB64)
	cases := []struct {
		name     string
		blob     string
		wantIter int
	}{
		{"legacy", legacyBlobB64, legacyIterations},
		{"current", currentBlobB64, currentIterations},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, iterations, err := decryptBlob(mustDecode(t, tc.blob), fixturePassword, knownIterations)
			if err != nil {
				t.Fatalf("decryptBlob: %v", err)
			}
			if !bytes.Equal(got, want) {
				t.Fatalf("plaintext mismatch\n got %x\nwant %x", got, want)
			}
			if iterations != tc.wantIter {
				t.Errorf("detected %d iterations, want %d", iterations, tc.wantIter)
			}
			if !bytes.HasPrefix(got, sqliteMagic) {
				t.Errorf("decrypted output does not start with the SQLite magic")
			}
		})
	}
}

// The migration in one test: an old blob becomes one the current app can read,
// with the contents intact.
func TestConvertLegacyToCurrent(t *testing.T) {
	plaintext, iterations, err := decryptBlob(mustDecode(t, legacyBlobB64), fixturePassword, knownIterations)
	if err != nil {
		t.Fatalf("decrypting legacy blob: %v", err)
	}
	if iterations != legacyIterations {
		t.Fatalf("expected the fixture to be legacy, detected %d", iterations)
	}

	converted, err := encryptBlob(plaintext, fixturePassword, currentIterations)
	if err != nil {
		t.Fatalf("encryptBlob: %v", err)
	}
	if len(converted) != saltLen+nonceLen+len(plaintext)+gcmTagLen {
		t.Errorf("converted length %d, want %d", len(converted), saltLen+nonceLen+len(plaintext)+gcmTagLen)
	}

	// Only the current parameters may open it now — that is what proves the
	// conversion actually happened rather than passing the blob through.
	if _, err := decryptWith(converted, fixturePassword, legacyIterations); err == nil {
		t.Error("converted blob still opens at the legacy iteration count")
	}
	roundTripped, detected, err := decryptBlob(converted, fixturePassword, knownIterations)
	if err != nil {
		t.Fatalf("decrypting converted blob: %v", err)
	}
	if detected != currentIterations {
		t.Errorf("detected %d iterations after conversion, want %d", detected, currentIterations)
	}
	if !bytes.Equal(roundTripped, plaintext) {
		t.Error("conversion did not preserve the plaintext")
	}
}

func TestEncryptUsesFreshSaltAndNonce(t *testing.T) {
	plaintext := mustDecode(t, fixturePlainB64)
	a, err := encryptBlob(plaintext, fixturePassword, currentIterations)
	if err != nil {
		t.Fatalf("encryptBlob: %v", err)
	}
	b, err := encryptBlob(plaintext, fixturePassword, currentIterations)
	if err != nil {
		t.Fatalf("encryptBlob: %v", err)
	}
	if bytes.Equal(a[:saltLen+nonceLen], b[:saltLen+nonceLen]) {
		t.Fatal("two encryptions reused the same salt and nonce")
	}
}

func TestWrongPasswordFails(t *testing.T) {
	for name, blob := range map[string]string{"legacy": legacyBlobB64, "current": currentBlobB64} {
		t.Run(name, func(t *testing.T) {
			if _, _, err := decryptBlob(mustDecode(t, blob), "not-the-password", knownIterations); err == nil {
				t.Fatal("expected an error for the wrong password, got nil")
			}
		})
	}
}

// -iter narrows the search; pointing it at the wrong count must fail rather
// than silently falling back to the full list.
func TestExplicitIterCountIsRespected(t *testing.T) {
	if _, _, err := decryptBlob(mustDecode(t, legacyBlobB64), fixturePassword, []int{currentIterations}); err == nil {
		t.Fatal("expected an error when the forced iteration count is wrong")
	}
	if _, iterations, err := decryptBlob(mustDecode(t, legacyBlobB64), fixturePassword, []int{legacyIterations}); err != nil {
		t.Fatalf("decryptBlob: %v", err)
	} else if iterations != legacyIterations {
		t.Errorf("detected %d, want %d", iterations, legacyIterations)
	}
}

func TestTamperedCiphertextFails(t *testing.T) {
	blob := mustDecode(t, currentBlobB64)
	blob[len(blob)-1] ^= 0xff // flip a bit in the GCM tag
	if _, _, err := decryptBlob(blob, fixturePassword, knownIterations); err == nil {
		t.Fatal("expected an error for a tampered blob, got nil")
	}
}

func TestShortInputRejected(t *testing.T) {
	if _, _, err := decryptBlob(make([]byte, 8), fixturePassword, knownIterations); err == nil {
		t.Fatal("expected an error for a truncated blob, got nil")
	}
}

func TestDefaultOutput(t *testing.T) {
	if got := defaultOutput("money-tracker-2026-09-05.enc", false); got != "money-tracker-2026-09-05.db" {
		t.Errorf("defaultOutput = %q", got)
	}
	if got := defaultOutput("creds.txt", true); got != "-" {
		t.Errorf("defaultOutput(base64) = %q", got)
	}
}
