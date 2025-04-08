import { useEffect, useRef, useState } from "react";
import logo from "/assets/openai-logomark.svg";
import EventLog from "./EventLog";
import SessionControls from "./SessionControls";
import ToolPanel from "./ToolPanel";
import DarkModeToggle from "./DarkModeToggle";
import { MessageSquare } from "lucide-react";

export default function App() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const peerConnection = useRef(null);
  const audioElement = useRef(null);
  const [toolsAdded, setToolsAdded] = useState([]);
  const [activeToolCall, setActiveToolCall] = useState(null);

  async function startSession(voiceId = "verse", instructions = "") {
    try {
      // Get a session token for OpenAI Realtime API
      const tokenResponse = await fetch("/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          voice: voiceId,
          instructions: instructions.trim() || undefined // Only send if not empty
        })
      });
      
      const data = await tokenResponse.json();
      
      // Check if the response has the expected structure
      if (!data || !data.client_secret || !data.client_secret.value) {
        console.error("Invalid token response", data);
        alert("Failed to start session: Invalid token response from server");
        return;
      }
      
      const EPHEMERAL_KEY = data.client_secret.value;

      // Create a peer connection
      const pc = new RTCPeerConnection();

      // Set up to play remote audio from the model
      audioElement.current = document.createElement("audio");
      audioElement.current.autoplay = true;
      pc.ontrack = (e) => (audioElement.current.srcObject = e.streams[0]);

      // Add local audio track for microphone input in the browser
      const ms = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      pc.addTrack(ms.getTracks()[0]);

      // Set up data channel for sending and receiving events
      const dc = pc.createDataChannel("oai-events");
      setDataChannel(dc);

      // Start the session using the Session Description Protocol (SDP)
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = data.model || "gpt-4o-realtime-preview-2024-12-17";
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp",
        },
      });

      const answer = {
        type: "answer",
        sdp: await sdpResponse.text(),
      };
      await pc.setRemoteDescription(answer);

      peerConnection.current = pc;
    } catch (error) {
      console.error("Failed to start session:", error);
      alert(`Failed to start session: ${error.message}`);
    }
  }

  // Stop current session, clean up peer connection and data channel
  function stopSession() {
    if (dataChannel) {
      dataChannel.close();
    }

    peerConnection.current.getSenders().forEach((sender) => {
      if (sender.track) {
        sender.track.stop();
      }
    });

    if (peerConnection.current) {
      peerConnection.current.close();
    }

    setIsSessionActive(false);
    setDataChannel(null);
    peerConnection.current = null;
    setEvents([]);
  }

  // Send a message to the model
  function sendClientEvent(message) {
    if (dataChannel) {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const eventToSend = { ...message, event_id: message.event_id || crypto.randomUUID() };
      dataChannel.send(JSON.stringify(eventToSend));
      setEvents((prev) => [{ ...eventToSend, timestamp, source: 'client' }, ...prev]);
    } else {
      console.error(
        "Failed to send message - no data channel available",
        message,
      );
    }
  }

  // Send a text message to the model
  function sendTextMessage(message) {
    console.log("Sending text message:", message);
    const event = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: message }],
      },
    };
    console.log("Text message event:", event);
    sendClientEvent(event);
    
    // After sending text, manually trigger a response from the AI
    setTimeout(() => {
      console.log("Sending response.create to trigger AI response");
      sendClientEvent({
        type: "response.create"
      });
    }, 100);
  }

  // Attach event listeners to the data channel when a new one is created
  useEffect(() => {
    if (dataChannel) {
      dataChannel.onmessage = (e) => {
        const event = JSON.parse(e.data);
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setEvents((prev) => [{ ...event, timestamp, source: 'server' }, ...prev]);
      };
      dataChannel.onopen = () => {
        setIsSessionActive(true);
        setEvents([]);
      };
      dataChannel.onclose = () => {
        console.log("Data channel closed");
        stopSession();
      };
    }
    return () => { dataChannel?.close(); };
  }, [dataChannel]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <nav className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-secondary-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-sm z-10">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          <h1 className="text-lg font-semibold text-secondary-800 dark:text-dark-text">Realtime Chat Console</h1>
        </div>
        <DarkModeToggle />
      </nav>

      {/* Main Content Area */}
      <main className="flex flex-1 min-h-0"> 
        {/* Chat/Event Area */}
        <section className="flex flex-col flex-1 h-full min-w-0 bg-white dark:bg-dark-background"> 
          <div className="flex-1 p-4 overflow-y-auto space-y-3 scroll-smooth">
            <EventLog events={events} />
          </div>
          <div className="flex-shrink-0 p-3 border-t border-secondary-200 dark:border-dark-border bg-white dark:bg-dark-surface">
            <SessionControls
              startSession={startSession}
              stopSession={stopSession}
              sendTextMessage={sendTextMessage}
              isSessionActive={isSessionActive}
            />
          </div>
        </section>

        {/* Tool Panel Area - Pass setter functions down */}
        <aside className="flex-shrink-0 w-[380px] h-full border-l border-secondary-200 dark:border-dark-border bg-secondary-50 dark:bg-dark-surface overflow-y-auto">
          <ToolPanel
            sendClientEvent={sendClientEvent}
            events={events}
            isSessionActive={isSessionActive}
            toolsAdded={toolsAdded} 
            setToolsAdded={setToolsAdded}
            activeToolCall={activeToolCall}
            setActiveToolCall={setActiveToolCall}
          />
        </aside>
      </main>
    </div>
  );
}
