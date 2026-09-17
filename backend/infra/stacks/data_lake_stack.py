"""
Data Lake Stack — S3 buckets, Glue database/tables, Athena workgroup.
Deployed to the Lake Formation region (ap-east-1).

Requires seed data in backend/infra/seed_data/tickit2/.
Run `python backend/infra/seed_data/download_tickit.py` first.
"""
import os
import aws_cdk as cdk
from aws_cdk import (
    aws_s3 as s3,
    aws_s3_deployment as s3deploy,
    aws_glue as glue,
    aws_athena as athena,
)
from constructs import Construct

# Glue type mapping
GLUE_TYPE = {
    "int": "int",
    "string": "string",
    "boolean": "boolean",
    "decimal(10,2)": "decimal(10,2)",
    "timestamp": "timestamp",
    "date": "date",
}

# Table definitions matching athena_ddl.sql
TABLES = {
    "users": [
        ("userid", "int"), ("username", "string"),
        ("firstname", "string"), ("lastname", "string"),
        ("city", "string"), ("state", "string"),
        ("email", "string"), ("phone", "string"),
        ("likesports", "boolean"), ("liketheatre", "boolean"),
        ("likeconcerts", "boolean"), ("likejazz", "boolean"),
        ("likeclassical", "boolean"), ("likeopera", "boolean"),
        ("likerock", "boolean"), ("likevegas", "boolean"),
        ("likebroadway", "boolean"), ("likemusicals", "boolean"),
    ],
    "venue": [
        ("venueid", "int"), ("venuename", "string"),
        ("venuecity", "string"), ("venuestate", "string"),
        ("venueseats", "int"),
    ],
    "category": [
        ("catid", "int"), ("catgroup", "string"),
        ("catname", "string"), ("catdesc", "string"),
    ],
    "listing": [
        ("listid", "int"), ("sellerid", "int"),
        ("eventid", "int"), ("dateid", "int"),
        ("numtickets", "int"), ("priceperticket", "decimal(10,2)"),
        ("totalprice", "decimal(10,2)"), ("listtime", "timestamp"),
    ],
    "event": [
        ("eventid", "int"), ("venueid", "int"),
        ("catid", "int"), ("dateid", "int"),
        ("eventname", "string"), ("starttime", "timestamp"),
    ],
    "date": [
        ("dateid", "int"), ("caldate", "date"),
        ("day", "string"), ("week", "int"),
        ("month", "string"), ("qtr", "int"),
        ("year", "int"), ("holiday", "boolean"),
    ],
    "sales": [
        ("salesid", "int"), ("listid", "int"),
        ("sellerid", "int"), ("buyerid", "int"),
        ("eventid", "int"), ("dateid", "int"),
        ("qtysold", "int"), ("pricepaid", "decimal(10,2)"),
        ("commission", "decimal(10,2)"), ("saletime", "timestamp"),
    ],
    "sales_extended": [
        ("salesid", "int"), ("listid", "int"),
        ("sellerid", "int"), ("buyerid", "int"),
        ("eventid", "int"), ("dateid", "int"),
        ("qtysold", "int"), ("pricepaid", "decimal(10,2)"),
        ("commission", "decimal(10,2)"), ("saletime", "timestamp"),
        ("team", "string"),
    ],
}


class DataLakeStack(cdk.Stack):
    def __init__(
        self,
        scope: Construct,
        id: str,
        *,
        database_name: str,
        data_bucket_prefix: str,
        data_prefix: str,
        **kwargs,
    ):
        super().__init__(scope, id, **kwargs)

        # ── S3: Data lake bucket (prefix + account + region for uniqueness) ──
        self.data_bucket = s3.Bucket(
            self, "DataBucket",
            bucket_name=f"{data_bucket_prefix}-{self.account}-{self.region}",
            removal_policy=cdk.RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

        # Deploy seed data from local directory
        seed_data_path = os.path.join(
            os.path.dirname(__file__), "..", "seed_data", data_prefix,
        )
        if os.path.isdir(seed_data_path):
            s3deploy.BucketDeployment(
                self, "SeedDataDeploy",
                sources=[s3deploy.Source.asset(seed_data_path)],
                destination_bucket=self.data_bucket,
                destination_key_prefix=data_prefix,
                memory_limit=512,
            )

        # Expose for cross-stack refs
        self.database_name = database_name

        # ── S3: Athena query results ──
        self.athena_results_bucket = s3.Bucket(
            self, "AthenaResultsBucket",
            # bucket_name=f"aws-athena-query-results-{self.account}-{self.region}",
            removal_policy=cdk.RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

        # ── Glue Database ──
        self.database = glue.CfnDatabase(
            self, "TickitDatabase",
            catalog_id=self.account,
            database_input=glue.CfnDatabase.DatabaseInputProperty(
                name=database_name,
                description="Tickit sample dataset for FGAC demo",
                location_uri=f"s3://{self.data_bucket.bucket_name}/{data_prefix}/",
            ),
        )

        # ── Glue Tables ──
        for table_name, columns in TABLES.items():
            glue.CfnTable(
                self, f"Table{table_name.title().replace('_', '')}",
                catalog_id=self.account,
                database_name=database_name,
                table_input=glue.CfnTable.TableInputProperty(
                    name=table_name,
                    table_type="EXTERNAL_TABLE",
                    parameters={"classification": "csv", "delimiter": "|"},
                    storage_descriptor=glue.CfnTable.StorageDescriptorProperty(
                        location=f"s3://{self.data_bucket.bucket_name}/{data_prefix}/{table_name}/",
                        input_format="org.apache.hadoop.mapred.TextInputFormat",
                        output_format="org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
                        serde_info=glue.CfnTable.SerdeInfoProperty(
                            serialization_library="org.apache.hadoop.hive.serde2.lazy.LazySimpleSerDe",
                            parameters={"field.delim": "|", "serialization.format": "|"},
                        ),
                        columns=[
                            glue.CfnTable.ColumnProperty(name=col, type=GLUE_TYPE.get(typ, typ))
                            for col, typ in columns
                        ],
                    ),
                ),
            ).add_dependency(self.database)

        # ── Athena Workgroup ──
        athena.CfnWorkGroup(
            self, "FgacWorkgroup",
            name="fgac-workgroup",
            state="ENABLED",
            work_group_configuration=athena.CfnWorkGroup.WorkGroupConfigurationProperty(
                result_configuration=athena.CfnWorkGroup.ResultConfigurationProperty(
                    output_location=f"s3://{self.athena_results_bucket.bucket_name}/",
                ),
                enforce_work_group_configuration=False,
            ),
        )

        # ── Outputs ──
        cdk.CfnOutput(self, "DatabaseName", value=database_name)
        cdk.CfnOutput(self, "DataBucketName", value=self.data_bucket.bucket_name)
        cdk.CfnOutput(self, "AthenaResultsBucketName", value=self.athena_results_bucket.bucket_name)
