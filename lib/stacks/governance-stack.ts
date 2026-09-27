import { Stack, StackProps, RemovalPolicy, Duration, Validations } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as config from 'aws-cdk-lib/aws-config';
import { TeamPermissionsBoundary } from '../constructs/iam-permissions-boundary';

// Shared, account-wide guardrails. Deployed ONCE, before any team stack.
export class GovernanceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // ---- Permissions boundary ----
    // The one boundary every team role must wear.
    const boundary = new TeamPermissionsBoundary(this, 'TeamBoundary');
    // cdk-nag: a boundary is a ceiling, so '*' is intentional; the Deny statements do the work.
    for (const finding of ['Action::*', 'Resource::*']) {
      Validations.of(boundary).acknowledge({
        id: `AwsSolutions::AwsSolutions-IAM5[${finding}]`,
        reason: 'Permissions boundary: Allow * is the ceiling, explicit Denies carve out escalation and audit tampering.',
      });
    }

    // ---- Access-log bucket ----
    // Records every read/write ON the audit bucket (who looked at the logs).
    const accessLogBucket = new s3.Bucket(this, 'AccessLogBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    Validations.of(accessLogBucket).acknowledge({
      id: 'AwsSolutions-S1',
      reason: 'This IS the access-log bucket; logging it to itself would loop.',
    });

    // ---- Audit log bucket ----
    // One locked-down bucket holds both CloudTrail and Config logs.
    const logBucket = new s3.Bucket(this, 'AuditLogBucket', {
      serverAccessLogsBucket: accessLogBucket,
      serverAccessLogsPrefix: 'audit-bucket/',
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      lifecycleRules: [{ expiration: Duration.days(365) }],
      removalPolicy: RemovalPolicy.RETAIN, // never delete audit logs with the stack
    });

    // ---- CloudTrail: WHO did WHAT, WHEN ----
    // Records every API call in every region.
    new cloudtrail.Trail(this, 'AuditTrail', {
      bucket: logBucket,
      isMultiRegionTrail: true,
      includeGlobalServiceEvents: true, // IAM is a global service
      enableFileValidation: true,       // detects tampering with log files
    });

    // ---- AWS Config: WHAT does everything look like, over time ----
    const configRole = new iam.Role(this, 'ConfigRole', {
      assumedBy: new iam.ServicePrincipal('config.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWS_ConfigRole')],
    });
    // Least privilege: Config may only write under its own prefix.
    configRole.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      resources: [logBucket.arnForObjects(`AWSLogs/${this.account}/Config/*`)],
    }));
    Validations.of(configRole).acknowledge({
      id: 'AwsSolutions::AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWS_ConfigRole]',
      reason: 'AWS_ConfigRole is the AWS-maintained policy for the Config recorder.',
    });
    Validations.of(configRole).acknowledge({
      id: 'AwsSolutions::AwsSolutions-IAM5[Resource::<AuditLogBucketCB3C9E27.Arn>/AWSLogs/<AWS::AccountId>/Config/*]',
      reason: 'Wildcard is limited to object keys under the Config log prefix.',
    });
    // Config checks it can see the bucket before writing to it.
    logBucket.addToResourcePolicy(new iam.PolicyStatement({
      principals: [new iam.ServicePrincipal('config.amazonaws.com')],
      actions: ['s3:GetBucketAcl', 's3:ListBucket'],
      resources: [logBucket.bucketArn],
    }));
    logBucket.addToResourcePolicy(new iam.PolicyStatement({
      principals: [new iam.ServicePrincipal('config.amazonaws.com')],
      actions: ['s3:PutObject'],
      resources: [logBucket.arnForObjects(`AWSLogs/${this.account}/Config/*`)],
      conditions: { StringEquals: { 's3:x-amz-acl': 'bucket-owner-full-control' } },
    }));

    // The recorder watches resources; the delivery channel ships snapshots to S3.
    const recorder = new config.CfnConfigurationRecorder(this, 'ConfigRecorder', {
      roleArn: configRole.roleArn,
      recordingGroup: { allSupported: true, includeGlobalResourceTypes: true },
    });
    const delivery = new config.CfnDeliveryChannel(this, 'ConfigDelivery', {
      s3BucketName: logBucket.bucketName,
    });
    delivery.addResourceDependency(recorder);

    // ---- Config rule: flag any resource missing a Team tag ----
    // Catches resources created outside CDK, which Tags.of() can't reach.
    const requiredTags = new config.ManagedRule(this, 'RequiredTeamTag', {
      identifier: config.ManagedRuleIdentifiers.REQUIRED_TAGS,
      inputParameters: { tag1Key: 'Team' },
    });
    requiredTags.node.addDependency(recorder);
    requiredTags.node.addDependency(delivery);
  }
}
