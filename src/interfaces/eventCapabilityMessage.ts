interface CapabilityMessage {
    type: string; // "CapabilityMessage"
    value: {
      capabilityId: string;
      class: {
        className: string; // e.g., "Capability.Status.Occupancy_Status"
      };
      configuration: {
        communicationConfigurationId: string;
        class: {
          className: string; // e.g., "CommunicationConfiguration.Sample.SampleConfiguration"
        };
        value: string; // JSON string containing additional configuration details
      };
      value: string; // JSON string containing the value and observation time details
      asset: {
        assetId: string;
        name: string;
        class: {
          className: string; // e.g., "Asset.Sensor.Presence_Sensor"
        };
        locatedInSpaceId: string;
        locatedIn: {
          spaceId: string;
          name: string;
          partOf: string;
          class: {
            className: string; // e.g., "Space"
          };
        };
        properties?: any | null; // Optional properties field
        tags?: string[]; // Optional tags field
      } | null;
      space: null;
    };
}

interface CapabilityValue {
    value: boolean | number | string; // depending on the type, e.g., true/false for occupancy
    observationTime: string; // timestamp in ISO format
  }



export default CapabilityMessage;
export { CapabilityMessage, CapabilityValue };