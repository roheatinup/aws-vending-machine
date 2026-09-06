import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface TeamStackProps extends StackProps {
  teamName: string;
}

export class TeamStack extends Stack {
  constructor(scope: Construct, id: string, props: TeamStackProps) {
    super(scope, id, props);
  }
}
