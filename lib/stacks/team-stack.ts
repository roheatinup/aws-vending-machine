import { Stack, StackProps, Tags, Validations } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as budgets from 'aws-cdk-lib/aws-budgets';

interface TeamStackProps extends StackProps {
  teamName: string;
  ownerEmail: string;       // who gets the budget alerts
  monthlyBudgetUsd: number; // the team's monthly spending limit
}

// One "vended" environment per team.
export class TeamStack extends Stack {
  constructor(scope: Construct, id: string, props: TeamStackProps) {
    super(scope, id, props);

    // ---- Mandatory tagging ----
    // Every resource in this stack automatically gets these tags.
    Tags.of(this).add('Team', props.teamName);
    Tags.of(this).add('Owner', props.ownerEmail);
    Tags.of(this).add('ManagedBy', 'aws-vending-machine');

    // ---- Boundary-capped developer role ----
    // Look up the boundary GovernanceStack created, by its fixed name.
    const boundary = iam.ManagedPolicy.fromManagedPolicyName(
      this,
      'TeamBoundary',
      'TeamPermissionsBoundary',
    );

    // Admin permissions, but capped by the boundary: the boundary decides
    // what they can actually do.
    const developerRole = new iam.Role(this, 'DeveloperRole', {
      roleName: `team-${props.teamName}-developer`, // "team-" prefix: passable under our PassRole rule
      assumedBy: new iam.AccountRootPrincipal(),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')],
      permissionsBoundary: boundary,
    });
    Validations.of(developerRole).acknowledge({
      id: 'AwsSolutions::AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/AdministratorAccess]',
      reason: 'AdministratorAccess is intentionally capped by TeamPermissionsBoundary.',
    });

    // ---- Per-team budget alarm ----
    // Emails the owner when this team's spend passes 80% of its monthly limit.
    new budgets.CfnBudget(this, 'TeamBudget', {
      budget: {
        budgetName: `team-${props.teamName}-monthly`,
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: props.monthlyBudgetUsd, unit: 'USD' },
        // Only count costs from resources tagged with this team.
        costFilters: { TagKeyValue: [`user:Team$${props.teamName}`] },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 80, // percent of the limit
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [{ subscriptionType: 'EMAIL', address: props.ownerEmail }],
        },
      ],
    });
  }
}
