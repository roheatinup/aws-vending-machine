#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GovernanceStack } from '../lib/stacks/governance-stack';
import { TeamStack } from '../lib/stacks/team-stack';

const app = new cdk.App();

new GovernanceStack (app, 'GovernanceStack');

new TeamStack (app, 'TeamStack-Alpha', { teamName: 'alpha' });
