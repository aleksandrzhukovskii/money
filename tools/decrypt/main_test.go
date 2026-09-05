package main

import (
	"bytes"
	"encoding/base64"
	"testing"
)

// Fixture produced by the browser implementation (src/lib/crypto.ts) running on
// Web Crypto, so this test proves the Go tool reads what the app actually writes.
const (
	fixturePassword = "test-password-123"
	fixtureBlobB64  = "n36Is14uiaBPgP/fDlRMVPXkdt90m1bmIRyQMWgbP2ZXct+vyaBE9/ASFK0w7ytqowW6aOPqodzxslHSNJS2mLTg9WkAoZkmIVDTdC3NEBqyWxGpDpzS67ONUPNTdcb+XQhIhQtAzmnGcZzl"
	fixturePlainB64 = "U1FMaXRlIGZvcm1hdCAzAGhlbGxvIG1vbmV5IHRyYWNrZXIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="
)

func mustDecode(t *testing.T, s string) []byte {
	t.Helper()
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		t.Fatalf("decoding fixture: %v", err)
	}
	return b
}

func TestDecryptsBrowserFixture(t *testing.T) {
	got, err := decryptBlob(mustDecode(t, fixtureBlobB64), fixturePassword, defaultIterations)
	if err != nil {
		t.Fatalf("decryptBlob: %v", err)
	}
	want := mustDecode(t, fixturePlainB64)
	if !bytes.Equal(got, want) {
		t.Fatalf("plaintext mismatch\n got %x\nwant %x", got, want)
	}
	if !bytes.HasPrefix(got, sqliteMagic) {
		t.Errorf("decrypted output does not start with the SQLite magic")
	}
}

func TestWrongPasswordFails(t *testing.T) {
	if _, err := decryptBlob(mustDecode(t, fixtureBlobB64), "not-the-password", defaultIterations); err == nil {
		t.Fatal("expected an error for the wrong password, got nil")
	}
}

func TestWrongIterationCountFails(t *testing.T) {
	if _, err := decryptBlob(mustDecode(t, fixtureBlobB64), fixturePassword, 600_000); err == nil {
		t.Fatal("expected an error for the wrong iteration count, got nil")
	}
}

func TestTamperedCiphertextFails(t *testing.T) {
	blob := mustDecode(t, fixtureBlobB64)
	blob[len(blob)-1] ^= 0xff // flip a bit in the GCM tag
	if _, err := decryptBlob(blob, fixturePassword, defaultIterations); err == nil {
		t.Fatal("expected an error for a tampered blob, got nil")
	}
}

func TestShortInputRejected(t *testing.T) {
	if _, err := decryptBlob(make([]byte, 8), fixturePassword, defaultIterations); err == nil {
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
