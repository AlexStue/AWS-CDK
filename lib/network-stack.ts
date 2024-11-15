import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elbv2_targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import { Construct } from 'constructs';

export class MyVpcAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

// ------------------------------------ Network
/*

cdk synth
cdk deploy
cdk destroy

Manual Stuff:
- VPC
- Security Group

1. VPC

2. Public
  2.1 AZ Zones & IP
  2.2 Public Subnet
  2.2 Internet Gateway
  2.4 Route Table
    Add Route: 0.0.0.0/0
    Add Target: Internet Gateway
    Associate with Public Subnets
  2.5 Security Group
    Inbound: (all)
    Outbound: (all)

3. Private
  3.1 AZ Zones & IP
  3.2 NAT Gateway
    Subnet: Public Subnet
    Allocate Elastic IP
  3.3 Private Subnet
    Create Subents
    Create Route Table: 0.0.0.0/0
    Add Targets to each NAT Gateway in Private Subnets
    Associate with Private Subents

4. EC2 Instances
  4.1 Security Group
  4.2 IAM Role (for SSM)
  4.3 Instance per Private Subnet

5. Loadbalancer
  5.1 ALB
  5.2 Security Group
    Inbound: 80
    Outbound: 80
    Attach to ALB
  5.3 Target Group
    Create
    Register Instances
  5.4 Listener
    Port 80

*/
// ------------------------------------ VPC

// VPC new
    //const vpc = new ec2.Vpc(this, 'MyCustomVpc', {
    //  cidr: '10.0.0.0/16',
    //});

// VPC existing 
    const vpc = ec2.Vpc.fromLookup(this, 'MyExistingVpc', {
      vpcId: 'vpc-05d64cdbb3ad8727c', // Replace with your VPC ID
      region: 'eu-central-1',         // Specify the region if needed
    });

// ------------------------------------ Public

// Define configurations for Public Subnets
    const PublicSubnetConfigs = [
      { availabilityZone: 'eu-central-1a', cidrBlock: '10.0.1.0/24' },
      { availabilityZone: 'eu-central-1b', cidrBlock: '10.0.4.0/24' },
    ];

// Internet Gateway
    const internetGateway = new ec2.CfnInternetGateway(this, 'InternetGateway');
    new ec2.CfnVPCGatewayAttachment(this, 'AttachGateway', {
      vpcId: vpc.vpcId,
      internetGatewayId: internetGateway.ref,
    });

// Route Table
    const publicRouteTable = new ec2.CfnRouteTable(this, 'PublicRouteTable', {
      vpcId: vpc.vpcId,
      tags: [
        {
          key: 'Name',
          value: 'PublicRouteTableToIGW',  // Specify the name you want to assign
        },
      ],
    });

    // Route and Target
    new ec2.CfnRoute(this, 'PublicSubnetRouteTarget', {
      routeTableId: publicRouteTable.ref,
      destinationCidrBlock: '0.0.0.0/0',   // Route for all outbound traffic
      gatewayId: internetGateway.ref,      // Direct to Internet Gateway
    });

// Public Subnets
    const publicSubnets = PublicSubnetConfigs.map((config, index) => {
    // Create Public Subnet
      const publicSubnet = new ec2.CfnSubnet(this, `PublicSubnet_${index + 1}`, {
        vpcId: vpc.vpcId,
        cidrBlock: config.cidrBlock,
        availabilityZone: config.availabilityZone,
        mapPublicIpOnLaunch: true, // Auto-assign public IPs to instances in the subnet
        tags: [
          {
            key: 'Name',
            value: `PublicSubnet_${index + 1}`,
          },
        ],
      });

    // Associate each Public Subnet with the public Route Table
      new ec2.CfnSubnetRouteTableAssociation(this, `PublicSubnetRouteTableAssoc_${index + 1}`, {
        subnetId: publicSubnet.ref,
        routeTableId: publicRouteTable.ref,
      });

      return publicSubnet; // Store each created subnet in the array
    });

// Security Group
    const securityGroup = new ec2.SecurityGroup(this, 'AllowHttpHttpsTrafficSG', {
      vpc,
      description: 'Security group for allowing HTTP and HTTPS traffic only',
      securityGroupName: 'PublicSubnet_SG_Port_80_443'  // Set the name here
    });

    // Allow inbound traffic
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),          // Allows any IPv4 address
      ec2.Port.tcp(80),            // Port 80 (HTTP)
      'Allow inbound HTTP traffic'
    );

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),          // Allows any IPv4 address
      ec2.Port.tcp(443),           // Port 443 (HTTPS)
      'Allow inbound HTTPS traffic'
    );

// ------------------------------------ Private

// Define configurations for Private Subnets
    const PrivateSubnetConfigs = [
      { availabilityZone: 'eu-central-1a', cidrBlock: '10.0.2.0/24' },
      { availabilityZone: 'eu-central-1b', cidrBlock: '10.0.5.0/24' },
    ];

// NAT Gateways
    const natGateways: ec2.CfnNatGateway[] = [];
    publicSubnets.forEach((publicSubnet, index) => {
      const natGatewayEip = new ec2.CfnEIP(this, `NatGatewayEIP_${index + 1}`);

      const natGateway = new ec2.CfnNatGateway(this, `NatGateway_${index + 1}`, {
        subnetId: publicSubnet.ref,
        allocationId: natGatewayEip.attrAllocationId,
        tags: [
          {
            key: 'Name',
            value: `PublicNatGateway_${index + 1}`,
          },
        ],
      });

      natGateways.push(natGateway);
    });

// Private Subnets
    const privateSubnets: ec2.CfnSubnet[] = PrivateSubnetConfigs.map((config, index) => {
    // Private Subnet
      const privateSubnet = new ec2.CfnSubnet(this, `PrivateSubnet_${index + 1}`, {
        vpcId: vpc.vpcId,
        cidrBlock: config.cidrBlock,
        availabilityZone: config.availabilityZone,
        tags: [
          {
            key: 'Name',
            value: `PrivateSubnet_${index + 1}`,
          },
        ],
      });

    // Route Table
      const privateRouteTable = new ec2.CfnRouteTable(this, `PrivateRouteTable_${index + 1}`, {
        vpcId: vpc.vpcId,
        tags: [
          {
            key: 'Name',
            value: `PrivateRouteTable_${index + 1}_ToNAT`,
          },
        ],
      });

    // Route to NAT Gateway
      new ec2.CfnRoute(this, `PrivateSubnetRouteTarget_${index + 1}`, {
        routeTableId: privateRouteTable.ref,
        destinationCidrBlock: '0.0.0.0/0',                         // Route all outbound traffic
        natGatewayId: natGateways[index % natGateways.length].ref, // Use NAT Gateway in round-robin
      });

    // Associate the Route Table with the Private Subnet
      new ec2.CfnSubnetRouteTableAssociation(this, `PrivateSubnetRouteTableAssoc_${index + 1}`, {
        subnetId: privateSubnet.ref,
        routeTableId: privateRouteTable.ref,
      });

      return privateSubnet; // Add the subnet to the array
    });

// ------------------------------------ Instances

// Use an existing security group
    const securityGroup_1_all = ec2.SecurityGroup.fromSecurityGroupId(this, 'SecurityGroup', 'sg-0822a6793c27228e3');

// Define the existing IAM role for SSM
    const instanceRole_1 = iam.Role.fromRoleArn(this, 'InstanceRole', 'arn:aws:iam::038462748247:role/SSM-Access-Role');

// Instances
    // Define the AMI as Amazon Linux 2023
    const ami = new ec2.AmazonLinuxImage({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023,
    });

    const instances: ec2.Instance[] = [];
    privateSubnets.forEach((privateSubnet, index) => {
    // Convert CfnSubnet to ISubnet
      const iSubnet = ec2.Subnet.fromSubnetAttributes(this, `ISubnet_${index + 1}`, {
        subnetId: privateSubnet.ref,
        availabilityZone: PrivateSubnetConfigs[index].availabilityZone,
      });

    // Create an instance in the private subnet
      const instance = new ec2.Instance(this, `Instance_${index + 1}`, {
        vpc,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
        machineImage: ami,
        keyName: 'key-aws-1',         // SSH key
        vpcSubnets: {
          subnets: [iSubnet],         // Place the instance in this specific private subnet
        },
        securityGroup: securityGroup_1_all,
        role: instanceRole_1,
      });

    // Add a Name tag to each instance
      cdk.Tags.of(instance).add('Name', `PrivateInstance_${index + 1}`);

    // Save instance in the array for later use
      instances.push(instance);
    });

/*
// ------------------------------------ Loadbalancer

// Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'MyALB', {
      vpc,
      internetFacing: true,       // ALB is publicly accessible
      loadBalancerName: 'MyALB',  // Name of the ALB
    });

// Security Group for the ALB to allow internal HTTP traffic
    const albSecurityGroup = new ec2.SecurityGroup(this, 'InternalALBSecurityGroup', {
      vpc,
      allowAllOutbound: true,
      description: 'Allow internal HTTP traffic to ALB',
    });

    // Allow inbound HTTP (port 80) traffic only from within the VPC CIDR range
    albSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),  // Restrict access to within the VPC
      ec2.Port.tcp(80),
      'Allow HTTP traffic from within VPC'
    );

    // Attach the security group to the ALB
    alb.addSecurityGroup(albSecurityGroup);

// Target Group all Instances
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'MyTargetGroup', {
      vpc,
      port: 80,                                  // Target port for instances
      protocol: elbv2.ApplicationProtocol.HTTP,  // Use HTTP protocol
      targetType: elbv2.TargetType.INSTANCE,
      healthCheck: {
        path: '/',                               // Health check path
        interval: cdk.Duration.seconds(30),
      },
    });

    // Register each EC2 instance in the private subnets as a target
    instances.forEach((instance, index) => {
      targetGroup.addTarget(new elbv2_targets.InstanceIdTarget(instance.instanceId, 80)); // With Port
    });

// Add a listener on port 80 for the internal ALB
    const listener = alb.addListener('InternalListener', {
      port: 80,                            // Listening on port 80 for HTTP traffic
      defaultTargetGroups: [targetGroup],  // Route traffic to the target group
    });

 */

  }
}