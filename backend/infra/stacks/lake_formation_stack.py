"""
Lake Formation Stack — LF Tags, Tag Assignments, Tag Permissions, and Row-Level Security.

Implements Tag-Based Access Control (TBAC):
- LF Tag: team = [TeamA, TeamB, shared]
- Table assignments: venue→TeamA, category/listing→TeamB, users/date→shared
- Row-level filter on sales_extended by team column
- Grant DESCRIBE+SELECT to each team role on their allowed tags
"""
import aws_cdk as cdk
from aws_cdk import (
    aws_iam as iam,
    aws_lakeformation as lf,
)
from constructs import Construct


class LakeFormationStack(cdk.Stack):
    def __init__(
        self,
        scope: Construct,
        id: str,
        *,
        database_name: str,
        team_a_role: iam.IRole,
        team_b_role: iam.IRole,
        **kwargs,
    ):
        super().__init__(scope, id, **kwargs)

        catalog_id = self.account

        # ── 0. Disable IAMAllowedPrincipals for new databases/tables ──
        # This switches Lake Formation to enforce its own permissions
        # instead of falling back to IAM-only access.
        lf.CfnDataLakeSettings(
            self, "LFSettings",
            create_database_default_permissions=[],
            create_table_default_permissions=[],
        )

        # ── 1. Create LF Tag: team = [TeamA, TeamB, shared] ──
        lf_tag = lf.CfnTag(
            self, "TeamTag",
            catalog_id=catalog_id,
            tag_key="team",
            tag_values=["TeamA", "TeamB", "shared"],
        )

        # ── 2. Assign LF Tags to Tables ──
        table_tag_assignments = {
            "venue": "TeamA",
            "category": "TeamB",
            "users": "shared",
            # "sales_extended": "shared",  # row-level filter handles team scoping
        }

        for table_name, tag_value in table_tag_assignments.items():
            assignment = lf.CfnTagAssociation(
                self, f"TagAssign-{table_name}",
                lf_tags=[
                    lf.CfnTagAssociation.LFTagPairProperty(
                        catalog_id=catalog_id,
                        tag_key="team",
                        tag_values=[tag_value],
                    )
                ],
                resource=lf.CfnTagAssociation.ResourceProperty(
                    table=lf.CfnTagAssociation.TableResourceProperty(
                        catalog_id=catalog_id,
                        database_name=database_name,
                        name=table_name,
                    ),
                ),
            )
            assignment.add_dependency(lf_tag)

        # ── 3. Grant LF Tag Permissions to Roles ──
        # TeamA: DESCRIBE, SELECT on team=TeamA and team=shared
        # TeamB: DESCRIBE, SELECT on team=TeamB and team=shared
        grants = [
            ("TeamA", team_a_role, ["TeamA", "shared"]),
            ("TeamB", team_b_role, ["TeamB", "shared"]),
        ]

        for team_name, role, tag_values in grants:
            grant = lf.CfnPrincipalPermissions(
                self, f"LFGrant-{team_name}",
                permissions=["DESCRIBE", "SELECT"],
                permissions_with_grant_option=[],
                principal=lf.CfnPrincipalPermissions.DataLakePrincipalProperty(
                    data_lake_principal_identifier=role.role_arn,
                ),
                resource=lf.CfnPrincipalPermissions.ResourceProperty(
                    lf_tag_policy=lf.CfnPrincipalPermissions.LFTagPolicyResourceProperty(
                        catalog_id=catalog_id,
                        resource_type="TABLE",
                        expression=[
                            lf.CfnPrincipalPermissions.LFTagProperty(
                                tag_key="team",
                                tag_values=tag_values,
                            ),
                        ],
                    ),
                ),
            )
            grant.add_dependency(lf_tag)

        # ── 4. Row-Level Security: Data Cell Filters on sales_extended ──
        # TeamA can only see rows where team = 'Team A'
        row_filter_a = lf.CfnDataCellsFilter(
            self, "RowFilter-TeamA",
            database_name=database_name,
            table_name="sales_extended",
            name="TeamA-RowFilter",
            table_catalog_id=catalog_id,
            row_filter=lf.CfnDataCellsFilter.RowFilterProperty(
                filter_expression="team = 'Team A'",
            ),
            column_wildcard=lf.CfnDataCellsFilter.ColumnWildcardProperty(),
        )
        row_filter_a.add_dependency(lf_tag)

        # TeamB can only see rows where team = 'Team B'
        row_filter_b = lf.CfnDataCellsFilter(
            self, "RowFilter-TeamB",
            database_name=database_name,
            table_name="sales_extended",
            name="TeamB-RowFilter",
            table_catalog_id=catalog_id,
            row_filter=lf.CfnDataCellsFilter.RowFilterProperty(
                filter_expression="team = 'Team B'",
            ),
            column_wildcard=lf.CfnDataCellsFilter.ColumnWildcardProperty(),
        )
        row_filter_b.add_dependency(lf_tag)

        # Grant each role access through their respective data cell filter
        row_grant_a = lf.CfnPrincipalPermissions(
            self, "RowFilterGrant-TeamA",
            permissions=["SELECT"],
            permissions_with_grant_option=[],
            principal=lf.CfnPrincipalPermissions.DataLakePrincipalProperty(
                data_lake_principal_identifier=team_a_role.role_arn,
            ),
            resource=lf.CfnPrincipalPermissions.ResourceProperty(
                data_cells_filter=lf.CfnPrincipalPermissions.DataCellsFilterResourceProperty(
                    database_name=database_name,
                    table_name="sales_extended",
                    name="TeamA-RowFilter",
                    table_catalog_id=catalog_id,
                ),
            ),
        )
        row_grant_a.add_dependency(row_filter_a)

        row_grant_b = lf.CfnPrincipalPermissions(
            self, "RowFilterGrant-TeamB",
            permissions=["SELECT"],
            permissions_with_grant_option=[],
            principal=lf.CfnPrincipalPermissions.DataLakePrincipalProperty(
                data_lake_principal_identifier=team_b_role.role_arn,
            ),
            resource=lf.CfnPrincipalPermissions.ResourceProperty(
                data_cells_filter=lf.CfnPrincipalPermissions.DataCellsFilterResourceProperty(
                    database_name=database_name,
                    table_name="sales_extended",
                    name="TeamB-RowFilter",
                    table_catalog_id=catalog_id,
                ),
            ),
        )
        row_grant_b.add_dependency(row_filter_b)
