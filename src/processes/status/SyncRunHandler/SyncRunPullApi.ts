/*
 * Copyright 2021 SpinalCom - www.spinalcom.com
 *
 * This file is part of SpinalCore.
 *
 * Please read all of the following terms and conditions
 * of the Free Software license Agreement ("Agreement")
 * carefully.
 *
 * This Agreement is a legally binding contract between
 * the Licensee (as defined below) and SpinalCom that
 * sets forth the terms and conditions that govern your
 * use of the Program. By installing and/or using the
 * Program, you agree to abide by all the terms and
 * conditions stated or referenced herein.
 *
 * If you do not agree to abide by these terms and
 * conditions, do not demonstrate your acceptance and do
 * not install or use the Program.
 * You should have received a copy of the license along
 * with this file. If not, see
 * <http://resources.spinalcom.com/licenses.pdf>.
 */

import moment = require('moment');
import {
  SpinalContext,
  SpinalGraph,
  SpinalGraphService,
  SpinalNode,
  SpinalNodeRef,
  SPINAL_RELATION_PTR_LST_TYPE,
} from 'spinal-env-viewer-graph-service';

import type OrganConfigModel from '../../../model/OrganConfigModel';

import { attributeService } from 'spinal-env-viewer-plugin-documentation-service';
import { NetworkService, SpinalBmsEndpoint } from 'spinal-model-bmsnetwork';
import {
  InputDataDevice,
  InputDataEndpoint,
  InputDataEndpointGroup,
  InputDataEndpointDataType,
  InputDataEndpointType,
} from '../../../model/InputData/InputDataModel/InputDataModel';
import { SpinalServiceTimeseries } from 'spinal-model-timeseries';
import { ClientConnector } from '../../../services/client/ClientAuth';
import {
  CapabilityMessage,
  CapabilityValue,
} from '../../../interfaces/eventCapabilityMessage';

/**
 * Main purpose of this class is to pull tickets from client.
 *
 * @export
 * @class SyncRunPull
 */
export class SyncRunPullApi {
  graph: SpinalGraph<any>;
  config: OrganConfigModel;
  interval: number;
  running: boolean;
  deviceIds: number[];
  nwService: NetworkService;
  networkContext: SpinalNode<any>;
  timeseriesService: SpinalServiceTimeseries;
  private clientConnector: ClientConnector;

  constructor(
    graph: SpinalGraph<any>,
    config: OrganConfigModel,
    nwService: NetworkService
  ) {
    this.graph = graph;
    this.config = config;
    this.running = false;
    this.nwService = nwService;
    this.timeseriesService = new SpinalServiceTimeseries();
    this.clientConnector = ClientConnector.getInstance();
  }

  async getNetworkContext(): Promise<SpinalNode<any>> {
    const contexts = await this.graph.getChildren();
    for (const context of contexts) {
      if (context.info.name.get() === process.env.NETWORK_NAME) {
        // @ts-ignore
        SpinalGraphService._addNode(context);
        return context;
      }
    }
    throw new Error('Network Context Not found');
  }

  private waitFct(nb: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(
        () => {
          resolve();
        },
        nb >= 0 ? nb : 0
      );
    });
  }

  // dateToNumber(dateString: string | Date) {
  //   const dateObj = new Date(dateString);
  //   return dateObj.getTime();
  // }
  // async addEndpointAttributes(node :SpinalNode<any>, measure : IDeviceMeasure ){
  //   await attributeService.addAttributeByCategoryName(node,'KardhamDigital','measure_code',measure.measure_code,'string')
  // }

  async addDeviceAttributes(node: SpinalNode<any>, assetId) {
    await attributeService.addAttributeByCategoryName(
      node,
      'KardhamDigital',
      'asset_id',
      `${assetId}`,
      'string'
    );
  }

  async createEndpoint(
    deviceId: string,
    endpointName: string,
    initialValue: number | string | boolean
  ) {
    const context = this.networkContext;
    const endpointNodeModel = new InputDataEndpoint(
      endpointName,
      initialValue,
      '',
      InputDataEndpointDataType.Real,
      InputDataEndpointType.Other
    );

    const res = new SpinalBmsEndpoint(
      endpointNodeModel.name,
      endpointNodeModel.path,
      endpointNodeModel.currentValue,
      endpointNodeModel.unit,
      InputDataEndpointDataType[endpointNodeModel.dataType],
      InputDataEndpointType[endpointNodeModel.type],
      endpointNodeModel.id
    );
    const childId = SpinalGraphService.createNode(
      { type: SpinalBmsEndpoint.nodeTypeName, name: endpointNodeModel.name },
      res
    );
    await SpinalGraphService.addChildInContext(
      deviceId,
      childId,
      context.getId().get(),
      SpinalBmsEndpoint.relationName,
      SPINAL_RELATION_PTR_LST_TYPE
    );

    const node = SpinalGraphService.getRealNode(childId);
    //await this.addEndpointAttributes(node,measure);
    return node;
  }
  async createDevice(deviceName) {
    const deviceNodeModel = new InputDataDevice(deviceName, 'device');
    await this.nwService.updateData(deviceNodeModel);
    console.log('Created device ', deviceName);

    //await this.modifyMaxDayAttribute();
  }

  async updateFromMessage(message: CapabilityMessage) {
    let devices = await this.networkContext.findInContext(
      this.networkContext,
      (node) => node.info.name.get() === message.value.asset.name
    );

    if (devices.length == 0) {
      console.log(
        'Device do not exist, creating new device... ',
        message.value.asset.name
      );
      await this.createDevice(message.value.asset.name);
      devices = await this.networkContext.findInContext(
        this.networkContext,
        (node) => node.info.name.get() === message.value.asset.name
      );
    }
    const deviceNode = devices[0];

    // @ts-ignore
    SpinalGraphService._addNode(deviceNode);

    this.addDeviceAttributes(deviceNode, message.value.asset.assetId);

    const endpointNodes = await deviceNode.getChildren('hasBmsEndpoint');

    // try to find endpoint that has the name
    const endpoint_value: CapabilityValue = JSON.parse(message.value.value);

    // convert the string to number if it's a string.
    // if(message.value.class.className == 'Capability.Status.Health_Status '){
    //   endpoint_value.value = endpoint_value.value === 'operational' ? 1 : 0;
    // }

    if (typeof endpoint_value.value === 'string') {
      console.log(`Converting string ${endpoint_value.value} to number `);
      endpoint_value.value = endpoint_value.value === 'operational' ? 1 : 0;
    }
    let endpointNode = endpointNodes.find(
      (node) => node.info.name.get() === message.value.class.className
    );
    if (!endpointNode) {
      // Create new endpoint
      console.log(
        'Endpoint do not exist, creating new endpoint... ',
        message.value.class.className
      );
      endpointNode = await this.createEndpoint(
        deviceNode.getId().get(),
        message.value.class.className,
        endpoint_value.value
      );
      SpinalGraphService._addNode(endpointNode);

      await this.nwService.setEndpointValue(
        endpointNode.info.id.get(),
        endpoint_value.value
      );

      if (endpoint_value.value) {
        await this.timeseriesService.pushFromEndpoint(
          endpointNode.info.id.get(),
          endpoint_value.value
        );
      }

      const realNode = SpinalGraphService.getRealNode(endpointNode.getId().get());
      await attributeService.updateAttribute(
        realNode,
        'default',
        'timeSeries maxDay',
        { value: '366' }
      );

    } else {
      SpinalGraphService._addNode(endpointNode);
      this.nwService.setEndpointValue(
        endpointNode.info.id.get(),
        endpoint_value.value
      );
      if (endpoint_value.value) {
        this.timeseriesService.pushFromEndpoint(
          endpointNode.info.id.get(),
          endpoint_value.value
        );
      }
    }
    console.log(
      'Updated endpoint ',
      message.value.class.className,
      'with value :',
      endpoint_value.value
    );
  }

  async init(): Promise<void> {
    console.log('Initiating SyncRunPull');
    this.networkContext = await this.getNetworkContext();
    try {
      await this.clientConnector.connect(
        process.env.CLIENT_CONNECTION_CHAIN,
        process.env.HubName
      );

      await this.clientConnector.receiveMessages(
        async (message: CapabilityMessage) => {
          if (
            message.type == 'CapabilityMessage' &&
            [
              'Capability.Status.Occupancy_Status',
              'Capability.Status.People_Counting_Status',
              'Capability.Status.Health_Status',
            ].includes(message.value.class.className)
          ) {
            //console.log(message.value)

            this.updateFromMessage(message);
            console.log('Endpoint name : ', message.value.class.className);
            // const endpoint_value: CapabilityValue = JSON.parse(
            //   message.value.value
            // );

            // console.log('Endpoint value : ', endpoint_value.value);
            // console.log(
            //   'Endpoint observation time : ',
            //   endpoint_value.observationTime
            // );
            // console.log('Asset/device name : ', message.value.asset.name);
            // console.log('Asset id : ', message.value.asset.assetId);
          }
        }
      );
      this.config.lastSync.set(Date.now());
      console.log('Init DONE !');
    } catch (e) {
      console.error(e);
    }
  }

  async run(): Promise<void> {
    console.log('Starting run...');
    this.running = true;
    const timeout = parseInt(process.env.PULL_INTERVAL);
    await this.waitFct(timeout);
    while (true) {
      if (!this.running) break;
      const before = Date.now();
      try {
        console.log('Updating Data...');
        //await this.updateEndpoints();
        console.log('... Data Updated !');
        this.config.client.lastSync.set(Date.now());
      } catch (e) {
        console.error(e);
        await this.waitFct(1000 * 60);
      } finally {
        const delta = Date.now() - before;
        const timeout = parseInt(process.env.PULL_INTERVAL) - delta;
        await this.waitFct(timeout);
      }
    }
  }

  stop(): void {
    this.clientConnector.closeConnection();
    this.running = false;
  }
}
export default SyncRunPullApi;
