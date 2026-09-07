import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

export class TeamPermissionsBoundary extends Construct {
    public readonly policy: iam.ManagedPolicy;

    constructor(scope: Construct, id: string) {
        super(scope, id);
    

        this.policy = new iam.ManagedPolicy(this, 'Boundary', {
            managedPolicyName: 'TeamPermissionsBoundary',
            statements: [
                new iam.PolicyStatement({
                    sid: 'DenyPrivelegeEscalation',
                    effect: iam.Effect.DENY,
                    actions: [
                        'iam:CreatePolicyVersion',
                        'iam:SetDefaultPolicyVersion',
                        'iam:AttachRolePolicy',
                        'iam:PutRolePolicy',

                    ],
                    resources: ['*'],
                }),
                new iam.PolicyStatement({
                    sid: 'DenyBoundaryModification',
                    effect: iam.Effect.DENY,
                    actions: [
                        'iam:DeleteRolePermissionsBoundary',
                        'iam:PutRolePermissionsBoundary',
                    ],
                    resources: ['*'],
                }),
                new iam.PolicyStatement({
                    sid: 'DenyAuditTampering',
                    effect: iam.Effect.DENY,
                    actions: [
                        'cloudtrail:StopLogging',
                        'cloudtrail:DeleteTrail',
                        'cloudtrail:UpdateTrail',
                        'config:DeleteConfigRule',
                        'config:StopConfigurationRecorder',
                    ],
                    resources: ['*'],
                })
            ],
        });
    }
}       

