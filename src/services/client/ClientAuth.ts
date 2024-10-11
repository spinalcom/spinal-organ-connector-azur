import { EventHubConsumerClient, earliestEventPosition , latestEventPosition} from "@azure/event-hubs";

export class ClientConnector {
    private static instance: ClientConnector;
    private consumerClient: EventHubConsumerClient | null = null;

    private constructor() {}

    public static getInstance(): ClientConnector {
        if (!ClientConnector.instance) {
            ClientConnector.instance = new ClientConnector();
        }
        return ClientConnector.instance;
    }

    public async connect(connectionString: string, eventHubName: string, consumerGroup: string = EventHubConsumerClient.defaultConsumerGroupName): Promise<void> {
        try {
            console.log('END POSITION', latestEventPosition)
            if (!this.consumerClient) {
                this.consumerClient = new EventHubConsumerClient(consumerGroup, connectionString, eventHubName);
                console.log("Connected to Azure Event Hub");
            } else {
                console.log("Already connected to Azure Event Hub");
            }
        } catch (error) {
            console.error("Failed to connect to Azure Event Hub:", error);
        }
    }

    public async receiveMessages(onMessageReceived: (message: any) => void): Promise<void> {
        if (!this.consumerClient) {
            console.error("Client not connected. Please connect first.");
            return;
        }

        this.consumerClient.subscribe({
            processEvents: async (events, context) => {
                for (const event of events) {
                    onMessageReceived(event.body);
                }
            },
            processError: async (err, context) => {
                console.error(`Error receiving events: ${err.message}`);
            }
        }, { startPosition: latestEventPosition });
    }

    public async closeConnection(): Promise<void> {
        if (this.consumerClient) {
            await this.consumerClient.close();
            console.log("Connection closed");
            this.consumerClient = null;
        } else {
            console.log("No active connection to close");
        }
    }
}