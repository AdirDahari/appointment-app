"""Print a fresh VAPID key pair in the format the .env file expects.

    cd backend
    venv\\Scripts\\python -m app.scripts.generate_vapid
"""
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from py_vapid import Vapid, b64urlencode


def main() -> None:
    vapid = Vapid()
    vapid.generate_keys()
    private_raw = vapid.private_key.private_numbers().private_value.to_bytes(32, "big")
    public_raw = vapid.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    print(f"VAPID_PUBLIC_KEY={b64urlencode(public_raw)}")
    print(f"VAPID_PRIVATE_KEY={b64urlencode(private_raw)}")


if __name__ == "__main__":
    main()
