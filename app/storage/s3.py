import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError
from flask import current_app
from .base import StorageBackend


class S3Storage(StorageBackend):

    def _get_client(self):
        return boto3.client(
            's3',
            region_name=current_app.config['AWS_S3_REGION'],
            aws_access_key_id=current_app.config['AWS_ACCESS_KEY_ID'],
            aws_secret_access_key=current_app.config['AWS_SECRET_ACCESS_KEY'],
            config=BotoConfig(signature_version='s3v4'),
        )

    def _get_bucket(self):
        return current_app.config['AWS_S3_BUCKET']

    def upload(self, file_data, filename, content_type):
        client = self._get_client()
        bucket = self._get_bucket()
        client.put_object(
            Bucket=bucket,
            Key=filename,
            Body=file_data,
            ContentType=content_type,
        )
        return self.public_url(filename)

    def public_url(self, filename):
        bucket = self._get_bucket()
        region = current_app.config['AWS_S3_REGION']
        return f'https://{bucket}.s3.{region}.amazonaws.com/{filename}'

    def presigned_post(self, filename, content_type, max_bytes, expires_in=600):
        return self._get_client().generate_presigned_post(
            Bucket=self._get_bucket(),
            Key=filename,
            Fields={'Content-Type': content_type},
            Conditions=[
                {'Content-Type': content_type},
                ['content-length-range', 1, max_bytes],
            ],
            ExpiresIn=expires_in,
        )

    def head(self, filename):
        try:
            response = self._get_client().head_object(Bucket=self._get_bucket(), Key=filename)
        except ClientError as e:
            if e.response.get('Error', {}).get('Code') in ('404', 'NoSuchKey', 'NotFound'):
                return None
            raise
        return {'size': response['ContentLength'], 'content_type': response.get('ContentType')}

    def delete(self, filename):
        client = self._get_client()
        bucket = self._get_bucket()
        client.delete_object(Bucket=bucket, Key=filename)
