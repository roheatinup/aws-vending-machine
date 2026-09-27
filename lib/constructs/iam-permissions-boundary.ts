import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Stack } from 'aws-cdk-lib';

export class TeamPermissionsBoundary extends Construct {
    public readonly policy: iam.ManagedPolicy;

    constructor(scope: Construct, id: string) {
        super(scope, id);
    
        const boundaryArn = `arn:aws:iam::${Stack.of(this).account}:policy/TeamPermissionsBoundary`;
        const teamRoleArns = `arn:aws:iam::${Stack.of(this).account}:role/team-*`;

        this.policy = new iam.ManagedPolicy(this, 'Boundary', {
            managedPolicyName: 'TeamPermissionsBoundary',
            statements: [
                new iam.PolicyStatement({
                    sid: 'AllowEverythingElse',
                    effect: iam.Effect.ALLOW,
                    actions: ['*'],
                    resources: ['*'],
                }),
                new iam.PolicyStatement({
                    sid: 'DenyRoleChangesWithoutBoundary',
                    effect: iam.Effect.DENY,
                    actions: ['iam:CreateRole',
                            'iam:AttachRolePolicy',
                            'iam:PutRolePolicy',
                    ],
                    resources: ['*'],
                    conditions: {
                        StringNotEquals: {
                            'iam:PermissionsBoundary': boundaryArn,
                        },
                    },
                }),
                new iam.PolicyStatement({
                    sid: 'DenyIamUsersAndGroups',
                    effect: iam.Effect.DENY,
                    actions: ['iam:CreateUser',
                            'iam:CreateAccessKey',
                            'iam:CreateLoginProfile',
                            'iam:AttachUserPolicy',
                            'iam:PutUserPolicy',
                            'iam:AddUserToGroup',
                            'iam:AttachGroupPolicy',
                            'iam:PutGroupPolicy',
                    ],
                    resources: ['*'],
                }),

                new iam.PolicyStatement({
                    sid: 'DenyPassingNonTeamRoles',
                    effect: iam.Effect.DENY,
                    actions: ['iam:PassRole'],    
                    notResources: [teamRoleArns],
                }), 
                new iam.PolicyStatement({
                    sid: 'DenyPrivilegeEscalation',
                    effect: iam.Effect.DENY,
                    actions: [
                        'iam:CreatePolicyVersion',
                        'iam:SetDefaultPolicyVersion',
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

