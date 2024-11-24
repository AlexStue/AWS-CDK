import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
//import * as elbv2_targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import * as globalaccelerator from 'aws-cdk-lib/aws-globalaccelerator';
import { Construct } from 'constructs';

// Define MultiRegionStackProps with a stricter type for env
interface MultiRegionStackProps extends cdk.StackProps {
  env: {
    region: string;  // Region for deployment
    account: string; // AWS Account ID
  };
}

export class MultiRegionStack extends cdk.Stack {
  public readonly alb: elbv2.CfnLoadBalancer; // Keep it as CfnLoadBalancer
  public readonly albArn: string; // Expose ALB ARN
  public readonly endpointConfiguration: globalaccelerator.CfnEndpointGroup.EndpointConfigurationProperty;
  
  constructor(scope: Construct, id: string, props: MultiRegionStackProps) {
    super(scope, id, props);

    const region = props.env.region;
    console.log(`Deploying resources to region: ${region}`);

// ------------------------------------ List
/*

cdk synth -all
cdk deploy -all
cdk destroy -all

cdk deploy -all --require-approval never
cdk destroy -all --require-approval never

Get a free exam retake - if you
need it.
Use code AWSRetake2025 at registration
Schedule your Foundational exam

*/

// ------------------------------------ Public

// Define only the VPC
    const vpc = new ec2.CfnVPC(this, `Vpc-${region}`, {
      cidrBlock: '10.0.0.0/16', // Define the CIDR block
      tags: [
        {
          key: 'Name',
          value: `Vpc-ProjectOne-${region}`, // Name the VPC
        },
      ],
    });
  
// Availability Zones
    const publicSubnets: ec2.CfnSubnet[] = [];
    const publicSubnetConfigs = [
      { availabilityZone: `${region}a`, cidrBlock: '10.0.1.0/24' },
      { availabilityZone: `${region}b`, cidrBlock: '10.0.4.0/24' },
    ];

// Internet Gateway
    const internetGateway = new ec2.CfnInternetGateway(this, `InternetGateway-${region}`, {
      tags: [
        {
          key: 'Name',
          value: `InternetGateway-${region}`,
        },
      ],
    });
    new ec2.CfnVPCGatewayAttachment(this, `AttachGateway-${region}`, {
      vpcId: vpc.ref,
      internetGatewayId: internetGateway.ref,
    });

// Route Table
    const publicRouteTable = new ec2.CfnRouteTable(this, `PublicRouteTable-${region}`, {
      vpcId: vpc.ref,
      tags: [
        {
          key: 'Name',
          value: `PublicRouteTable-${region}-toIGN`,
        },
      ],
    });

    // Route and Target
    new ec2.CfnRoute(this, `PublicSubnetRouteTarget-${region}`, {
      routeTableId: publicRouteTable.ref,
      destinationCidrBlock: '0.0.0.0/0', // Route for all outbound traffic
      gatewayId: internetGateway.ref,    // Direct to Internet Gateway
    });

// Public Subnets
    publicSubnetConfigs.forEach((config, index) => {
      // Create Public Subnet
      const publicSubnet = new ec2.CfnSubnet(this, `PublicSubnet-${region}-Nr${index + 1}`, {
        vpcId: vpc.ref,
        cidrBlock: config.cidrBlock,
        availabilityZone: config.availabilityZone,
        mapPublicIpOnLaunch: true, // Auto-assign public IPs to instances in the subnet
        tags: [
          {
            key: 'Name',
            value: `PublicSubnet-${region}-Nr${index + 1}`,
          },
        ],
      });

      // Associate the Public Subnet with the route table
      new ec2.CfnSubnetRouteTableAssociation(this, `PublicSubnetRouteTableAssoc-${region}-Nr${index + 1}`, {
        subnetId: publicSubnet.ref,
        routeTableId: publicRouteTable.ref,
      });

      // Add public subnet to the array
      publicSubnets.push(publicSubnet);  // Ensure the subnet is added to the array
    });

// Create Security Group
    const cfnSecurityGroup = new ec2.CfnSecurityGroup(this, `SG-${region}-Port-80-443`, {
      vpcId: vpc.ref,
      groupDescription: 'Allow HTTP and HTTPS traffic only',
      securityGroupIngress: [
        {
          ipProtocol: 'tcp',
          fromPort: 80,
          toPort: 80,
          cidrIp: '0.0.0.0/0',  // Allow inbound HTTP traffic from any IP
        },
        {
          ipProtocol: 'tcp',
          fromPort: 443,
          toPort: 443,
          cidrIp: '0.0.0.0/0',  // Allow inbound HTTPS traffic from any IP
        },
      ],
    });

// ------------------------------------ Private

// Define configurations for Private Subnets
    const PrivateSubnetConfigs = [
      { availabilityZone: `${region}a`, cidrBlock: '10.0.2.0/24' },
      { availabilityZone: `${region}b`, cidrBlock: '10.0.5.0/24' },
    ];

// Create NAT Gateways in Public Subnets
    const natGateways: ec2.CfnNatGateway[] = [];
    publicSubnets.forEach((publicSubnet, index) => {
      const natGatewayEip = new ec2.CfnEIP(this, `NatGatewayEIP-${region}-Nr${index + 1}`);

      const natGateway = new ec2.CfnNatGateway(this, `NatGateway-${region}-Nr${index + 1}`, {
        subnetId: publicSubnet.ref,               // Attach to the public subnet
        allocationId: natGatewayEip.attrAllocationId,
        tags: [
          {
            key: 'Name',
            value: `PublicNatGateway-${region}-Nr${index + 1}`,
          },
        ],
      });

      natGateways.push(natGateway);
    });

// Private Subnets
    const privateSubnets: ec2.CfnSubnet[] = PrivateSubnetConfigs.map((config, index) => {
      const privateSubnet = new ec2.CfnSubnet(this, `PrivateSubnet-${region}-Nr${index + 1}`, {
        vpcId: vpc.ref,
        cidrBlock: config.cidrBlock,
        availabilityZone: config.availabilityZone,
        tags: [
          {
            key: 'Name',
            value: `PrivateSubnet-${region}-Nr${index + 1}`,
          },
        ],
      });

      // Route Table for Private Subnet
      const privateRouteTable = new ec2.CfnRouteTable(this, `PrivateRouteTable-${region}-Nr${index + 1}`, {
        vpcId: vpc.ref,  // Use the VPC created earlier
        tags: [
          {
            key: 'Name',
            value: `PrivateRouteTable-${region}-Nr${index + 1}_toNAT`,
          },
        ],
      });

      // Route to NAT Gateway (round-robin distribution)
      new ec2.CfnRoute(this, `PrivateSubnetRouteTarget-${region}-Nr${index + 1}`, {
        routeTableId: privateRouteTable.ref,
        destinationCidrBlock: '0.0.0.0/0',                         // Route all outbound traffic
        natGatewayId: natGateways[index % natGateways.length].ref, // Use NAT Gateway in round-robin
      });

      // Associate Route Table with Private Subnet
      new ec2.CfnSubnetRouteTableAssociation(this, `PrivateSubnetRouteTableAssoc-${region}-Nr${index + 1}`, {
        subnetId: privateSubnet.ref,
        routeTableId: privateRouteTable.ref,
      });

      return privateSubnet;
    });

// ------------------------------------ Instances

// Mapping für Regionen und Docker-Images
    const instances: ec2.CfnInstance[] = [];

    const amiId = new ec2.AmazonLinuxImage({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023,
    }).getImage(this).imageId;

// instances in private subnets
    privateSubnets.forEach((privateSubnet, index) => {
      const userData = ec2.UserData.forLinux();
      userData.addCommands(
        'sudo yum install httpd -y',
        `echo "Instance-${region}-Nr${index + 1}" | sudo tee /var/www/html/index.html`,
        'sudo systemctl start httpd',
        'sudo systemctl enable httpd',
      );
      const instance = new ec2.CfnInstance(this, `Instance-${region}-Nr${index + 1}`, {
        imageId: amiId,
        instanceType: 't2.micro',
        keyName: 'key-aws-1',
        subnetId: privateSubnet.ref,
        securityGroupIds: [cfnSecurityGroup.ref],
        userData: cdk.Fn.base64(userData.render()), // Encode the UserData
        tags: [
          {
            key: 'Name',
            value: `PrivateInstance-${region}-Nr${index + 1}`,
          },
        ],
      });

      instances.push(instance);
    });

// ------------------------------------ Load Balancer

// ALB
    // Create ALB
    this.alb = new elbv2.CfnLoadBalancer(this, `ALB-${props?.env?.region}`, {
      subnets: publicSubnets.map(subnet => subnet.ref),
      securityGroups: [cfnSecurityGroup.ref],
      loadBalancerAttributes: [
        {
          key: 'idle_timeout.timeout_seconds',
          value: '60',
        },
      ],
      scheme: 'internet-facing',
    });

    // Expose the ALB ARN
    this.albArn = this.alb.attrLoadBalancerArn; // Use attrLoadBalancerArn to get the ARN

// Target Group
    const targetGroup = new elbv2.CfnTargetGroup(this, `TargetGroup-${region}`, {
      vpcId: vpc.ref,
      protocol: 'HTTP',
      port: 80,
      targetType: 'instance',
      targets: instances.map(instance => ({
        id: instance.ref
      }))
    });

// Listener
    new elbv2.CfnListener(this, `ALBListener-${region}`, {
      loadBalancerArn: this.alb.ref,
      port: 80,
      protocol: 'HTTP',
      defaultActions: [
        {
          type: 'forward',
          targetGroupArn: targetGroup.ref,
        },
      ],
    });

// ------------------------------------ Global Accelerator

    this.endpointConfiguration = {
      endpointId: this.alb.ref,
      weight: 100,
    };

// end
  }
}