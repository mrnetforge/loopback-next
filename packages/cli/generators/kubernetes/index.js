// Copyright IBM Corp. 2020. All Rights Reserved.
// Node module: @loopback/cli
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';
const BaseGenerator = require('../../lib/base-generator');
const artifacts = require('./artifacts');
const g = require('../../lib/globalize');
const fs = require('fs');
const Project = require('@lerna/project');

module.exports = class KubernetesGenerator extends BaseGenerator {
  constructor(args, opts) {
    super(args, opts);
    this.isMonorepo = false;
    this.projectRoot = process.cwd();
    this.packages = [];
    this.isLoopBackExample = false;
    this.targetLocation = this.projectRoot;
    this.artifactsPath = path.join(this.projectRoot, '/kubernetes');
  }

  _setupGenerator() {
    this.option('namespace', {
      type: String,
      required: false,
      description: g.f('k8s namespace'),
    });

    this.option('helm', {
      type: Boolean,
      required: false,
      description: g.f('do you want to create helm charts ?'),
    });
  }

  async getCloudNamespace() {
    this.namespace = this.options['namespace'] || await this.prompt([{
      type: 'input',
      name: 'namespace',
      message: g.f('Please enter the namespace of the kubernetes cluster'),
      default: 'default',
    }]);
  }

  async checkMonoRepo() {
    this.isMonorepo = await fs.exists(
      path.join(this.projectRoot, 'lerna.json'),
    );
    if (this.isMonorepo) {
      const project = new Project(this.projectRoot);
      debug('Lerna monorepo', project);
      const packages = await project.getPackages();
      for (const p of packages) {
        this.packages.push({
          name: p.name,
          location: p.location,
        });
      }
    }
  }

  async checkSinglePackage() {
    const pkgJson = await fs.readFile(
      path.join(this.projectRoot, 'package.json'),
    );
    if (!this.isMonorepo) {
      this.packages.push({
        name: pkgJson.name,
        location: this.projectRoot,
      });
    }
    this.appName = pkgJson.name;
  }

  async isHelmRequired() {
    this.isHelmCharts = this.options['helm'] || await this.prompt([{
      type: 'confirm',
      name: 'helm',
      message: g.f('do you want to create helm charts ?'),
      default: 'default',
    }]);
    this.targetLocation = path.join(this.projectRoot, '/helm');
    this.artifactsPath = path.join(this.targetLocation, '/templates');
  }

  async scaffold() {
    let templates = [];
    for (const pkg of this.packages) {
      let answers = await this.prompt([
        {
          type: 'input',
          name: 'name',
          message: g.f(
            'Please enter the deployment spec name for the package %s:',
            `${pkg.name}`,
          ),
          default: pkg.name,
        },
        {
          type: 'list',
          name: 'serviceType',
          choices: ['ClusterIP', 'NodePort', 'None'],
          message: g.f(
            'Please select the service type for the deployment of %s:',
            `${pkg.name}`,
          ),
          default: pkg.name,
        },
        {
          type: 'input',
          name: 'dockerImage',
          message: g.f(
            'Please enter the docker image name of %s:',
            `${pkg.name}`,
          ),
          default: pkg.name,
        },
        {
          type: 'input',
          name: 'dockerImageVersion',
          message: g.f(
            'Please enter the docker image version of %s:',
            `${pkg.name}`,
          ),
          default: `1.0.0`,
        }
      ]);
      templates.push({
        name: answers.name,
        image: answers.dockerImage + ':' + answers.dockerImageVersion,
        isClusterIp: answers.serviceType === 'ClusterIP',
        isNodePort: answers.serviceType === 'NodePort',
        isHeadlessService: answers.serviceType === 'None',
        type: answers.serviceType
      });
    }
    let images = {};
    for (let template of templates) {
      if (this.isHelmCharts) {
         images[template.name] = template.image
         template.image = `.Values.images.${template.name}`;
      }
      await artifacts.generateKubernetes(this.artifactsPath, template);
    }
    if (isHelmCharts) {
      await artifacts.generateHelm(this.targetLocation, this.appName, images);
    }
  }

  async end() {
    await super.end();
  }
};
