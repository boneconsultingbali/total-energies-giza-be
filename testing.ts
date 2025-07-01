import { EmailClient } from "@azure/communication-email";

const connectionString =
  "endpoint=https://total-energies-giza-email-service.france.communication.azure.com/;accesskey=4uLiAANYIkR4BeDaoTQFEMwgJzy0myC0dsJ0VUjW09HduQMuPqJiJQQJ99BGACULyCpeFOaWAAAAAZCSbf7z";
const client = new EmailClient(connectionString);

async function main() {
  const emailMessage = {
    senderAddress: "DoNotReply@giza-totalenergies.com",
    content: {
      subject: "Test Email",
      plainText: "Hello world via email.",
      html: `
			<html>
				<body>
					<h1>Hello world via email.</h1>
				</body>
			</html>`,
    },
    recipients: {
      to: [{ address: "lazlanrafar@gmail.com" }],
    },
  };

  const poller = await client.beginSend(emailMessage);
  const result = await poller.pollUntilDone();

  console.log("Email sent successfully:", result);
}

main();
