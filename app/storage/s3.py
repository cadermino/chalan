import boto3
from botocore.config import Config as BotoConfig
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
        region = current_app.config['AWS_S3_REGION']
        return f'https://{bucket}.s3.{region}.amazonaws.com/{filename}'

    def delete(self, filename):
        client = self._get_client()
        bucket = self._get_bucket()
        client.delete_object(Bucket=bucket, Key=filename)
