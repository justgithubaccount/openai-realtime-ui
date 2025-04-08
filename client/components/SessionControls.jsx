import { useState } from "react";
import { CloudLightning, CloudOff, MessageSquare } from "react-feather";
import Button from "./Button";

function SessionStopped({ startSession }) {
  const [isActivating, setIsActivating] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("verse"); // Default voice
  const [instructions, setInstructions] = useState(""); // Add state for instructions

  const voices = [
    { id: "alloy", name: "Alloy (Female)" },
    { id: "ash", name: "Ash (Male)" },
    { id: "ballad", name: "Ballad (Male)" },
    { id: "coral", name: "Coral (Female)" },
    { id: "echo", name: "Echo (Male)" },
    { id: "sage", name: "Sage (Female)" },
    { id: "shimmer", name: "Shimmer (Female)" },
    { id: "verse", name: "Verse (Male)" },
  ];

  function handleStartSession() {
    if (isActivating) return;

    setIsActivating(true);
    startSession(selectedVoice, instructions); // Pass instructions to startSession
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-3">
      <div className="flex items-center gap-2 mb-2">
        <label htmlFor="voice-select" className="text-sm text-secondary-700 dark:text-dark-text-secondary">
          Voice:
        </label>
        <select
          id="voice-select"
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value)}
          disabled={isActivating}
          className="px-2 py-1 text-sm rounded border border-secondary-200 dark:border-dark-border bg-white dark:bg-dark-surface dark:text-dark-text"
        >
          {voices.map(voice => (
            <option key={voice.id} value={voice.id}>
              {voice.name}
            </option>
          ))}
        </select>
      </div>
      
      <div className="w-full max-w-md mb-2">
        <label htmlFor="instructions" className="block text-sm text-secondary-700 dark:text-dark-text-secondary mb-1">
          System Instructions (optional):
        </label>
        <textarea
          id="instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          disabled={isActivating}
          placeholder="You are a helpful assistant..."
          className="w-full px-2 py-1 text-sm rounded border border-secondary-200 dark:border-dark-border bg-white dark:bg-dark-surface dark:text-dark-text h-24 resize-none"
        />
      </div>
      
      <Button
        onClick={handleStartSession}
        className={isActivating ? "bg-gray-600 dark:bg-gray-700" : "bg-red-600 dark:bg-purple-600 start-session-btn"}
        icon={<CloudLightning height={16} />}
      >
        {isActivating ? "starting session..." : "start session"}
      </Button>
    </div>
  );
}

function SessionActive({ stopSession, sendTextMessage }) {
  const [message, setMessage] = useState("");

  function handleSendClientEvent() {
    sendTextMessage(message);
    setMessage("");
  }

  return (
    <div className="flex items-center justify-center w-full h-full gap-4">
      <input
        onKeyDown={(e) => {
          if (e.key === "Enter" && message.trim()) {
            handleSendClientEvent();
          }
        }}
        type="text"
        placeholder="send a text message..."
        className="border border-gray-200 dark:border-gray-600 rounded-full p-4 flex-1 dark:bg-gray-700 dark:text-white"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <Button
        onClick={() => {
          if (message.trim()) {
            handleSendClientEvent();
          }
        }}
        icon={<MessageSquare height={16} />}
        className="bg-blue-400 dark:bg-blue-600"
      >
        send text
      </Button>
      <Button 
        onClick={stopSession} 
        icon={<CloudOff height={16} />}
        className="dark:bg-gray-700"
      >
        disconnect
      </Button>
    </div>
  );
}

export default function SessionControls({
  startSession,
  stopSession,
  sendClientEvent,
  sendTextMessage,
  serverEvents,
  isSessionActive,
}) {
  return (
    <div className="flex gap-4 border-t-2 border-gray-200 dark:border-gray-700 h-full rounded-md">
      {isSessionActive ? (
        <SessionActive
          stopSession={stopSession}
          sendClientEvent={sendClientEvent}
          sendTextMessage={sendTextMessage}
          serverEvents={serverEvents}
        />
      ) : (
        <SessionStopped startSession={startSession} />
      )}
    </div>
  );
}
