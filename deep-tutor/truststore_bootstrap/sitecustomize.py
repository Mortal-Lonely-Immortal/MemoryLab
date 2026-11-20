"""Use the Windows certificate store for HTTPS.

Corporate TLS-inspection proxies and some antivirus products install a local
root CA in the Windows store but not in Python's certifi bundle.  DeepTutor's
embedding calls then fail with CERTIFICATE_VERIFY_FAILED even though Edge,
PowerShell and curl succeed.  truststore delegates verification to the OS
store so those certificates are trusted without disabling verification.
"""
try:
    import truststore
    truststore.inject_into_ssl()
except Exception as exc:  # keep startup working on a bare Python
    try:
        import sys
        sys.stderr.write("truststore bootstrap skipped: %s\n" % exc)
    except Exception:
        pass
