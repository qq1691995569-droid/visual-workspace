"""Initialize private TLS files for the dedicated LAN upscale service (requires cryptography)."""
import argparse
import datetime
import ipaddress
import json
from pathlib import Path
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID

parser = argparse.ArgumentParser()
parser.add_argument('--host', required=True, help='This computer LAN IPv4 address')
args = parser.parse_args()
host = ipaddress.ip_address(args.host)
if not host.is_private or host.is_loopback or host.is_unspecified:
    raise SystemExit('Use this computer private LAN address')
directory = Path(__file__).resolve().parent.parent / '.canvas-data'
directory.mkdir(exist_ok=True)
files = [directory / name for name in ['upscale-sharing.json', 'upscale-share-key.pem', 'upscale-share-cert.pem']]
if any(file.exists() for file in files):
    raise SystemExit('Sharing files already exist; preserve existing certificates and access credentials')
key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Canvas Upscale LAN')])
now = datetime.datetime.now(datetime.timezone.utc)
cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
        .serial_number(x509.random_serial_number()).not_valid_before(now - datetime.timedelta(minutes=5))
        .not_valid_after(now + datetime.timedelta(days=365))
        .add_extension(x509.SubjectAlternativeName([x509.IPAddress(host)]), critical=False)
        .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
        .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
        .sign(key, hashes.SHA256()))
files[1].write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
files[2].write_bytes(cert.public_bytes(serialization.Encoding.PEM))
files[0].write_text(json.dumps({'origin': f'https://{host}:5443', 'bindHost': str(host), 'clients': []}), encoding='utf-8')
print(f'Sharing initialized: https://{host}:5443 (no clients authorized yet)')
