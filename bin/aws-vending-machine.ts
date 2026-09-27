#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Validations } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { GovernanceStack } from '../lib/stacks/governance-stack';
import { TeamStack } from '../lib/stacks/team-stack';

const app = new cdk.App();

// cdk-nag: check everything against AWS Solutions (Well-Architected) rules.
// Any unacknowledged finding FAILS the synth, and therefore fails CI.
Validations.of(app).addPlugins(new AwsSolutionsChecks(app));

const governance = new GovernanceStack(app, 'GovernanceStack');

// The vending machine: add a team here and deploy to vend a new environment.
const teams = [
  { teamName: 'alpha', ownerEmail: 'roaheenmansuri@gmail.com', monthlyBudgetUsd: 50 },
  { teamName: 'beta', ownerEmail: 'roaheenmansuri@gmail.com', monthlyBudgetUsd: 25 },
];

for (const team of teams) {
  const teamStack = new TeamStack(app, `TeamStack-${team.teamName}`, team);
  // The boundary must exist before a team role can wear it.
  teamStack.addStackDependency(governance);
}
