#!/bin/sh
# SeaweedFS (S3-compatible object storage) in a single container: master + volume + filer + S3 gateway.
# The S3 credentials come from the environment and are written to a config file at start,
# so no secret is stored in the repository or in the image.
set -e
: "${S3_ACCESS_KEY:?S3_ACCESS_KEY não definida}"
: "${S3_SECRET_KEY:?S3_SECRET_KEY não definida}"
cat > /tmp/s3.json <<EOF
{
  "identities": [
    {
      "name": "app",
      "credentials": [{ "accessKey": "${S3_ACCESS_KEY}", "secretKey": "${S3_SECRET_KEY}" }],
      "actions": ["Admin", "Read", "Write", "List", "Tagging"]
    }
  ]
}
EOF
exec weed server \
  -dir=/data \
  -ip=127.0.0.1 \
  -ip.bind=0.0.0.0 \
  -master.volumeSizeLimitMB=1024 \
  -volume.max=0 \
  -s3 -s3.port=8333 -s3.config=/tmp/s3.json
