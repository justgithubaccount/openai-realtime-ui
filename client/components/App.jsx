import { useEffect, useRef, useState } from "react";
import logo from "/assets/realtime-chat-logo.svg";
import EventLog from "./EventLog";
import SessionControls from "./SessionControls";
import ToolPanel from "./ToolPanel";
import DarkModeToggle from "./DarkModeToggle";

// Audio Waveform component to visualize AI speaking
function AudioWaveform({ isActive }) {
  if (!isActive) return null;
  
  return (
    <div className="audio-waveform flex items-center px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md">
      <div className="flex items-center gap-1 mr-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div 
            key={i}
            className="w-1 bg-green-500 dark:bg-green-400 rounded-full"
            style={{ 
              height: `${Math.max(4, Math.floor(Math.random() * 24))}px`,
              animation: `waveform 0.5s ease infinite ${i * 0.1}s`
            }}
          ></div>
        ))}
      </div>
      <span className="text-sm font-medium">AI is speaking...</span>
    </div>
  );
}

export default function App() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const peerConnection = useRef(null);
  const audioElement = useRef(null);
  const [toolsAdded, setToolsAdded] = useState([]);
  const [activeToolCall, setActiveToolCall] = useState(null);
  const [isAISpeaking, setIsAISpeaking] = useState(false);

  // Add waveform animation style to document head
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes waveform {
        0%, 100% { height: 4px; }
        50% { height: 20px; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

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
      pc.ontrack = (e) => {
        audioElement.current.srcObject = e.streams[0];
        // Trigger recheck of audio analysis when track changes
        setIsAISpeaking(false);
      };

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
        
        // Check for speech events to detect when AI is speaking
        if (event.type === 'speech.started') {
          setIsAISpeaking(true);
        } else if (event.type === 'speech.stopped' || event.type === 'speech.done') {
          setIsAISpeaking(false);
        }
        
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

  // Add audio analyzers to detect when AI is speaking
  useEffect(() => {
    if (!audioElement.current || !audioElement.current.srcObject) return;
    
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(audioElement.current.srcObject);
      source.connect(analyser);
      
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // Check audio levels periodically to determine if AI is speaking
      const checkAudioInterval = setInterval(() => {
        if (!audioElement.current || !audioElement.current.srcObject) {
          clearInterval(checkAudioInterval);
          setIsAISpeaking(false);
          return;
        }
        
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average frequency - if above threshold, AI is speaking
        const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
        setIsAISpeaking(average > 5); // Threshold may need adjustment
      }, 100);
      
      return () => clearInterval(checkAudioInterval);
    } catch (error) {
      console.error("Failed to setup audio analysis:", error);
    }
  }, [audioElement.current?.srcObject]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <nav className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-secondary-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-sm z-10">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Realtime Chat Logo" className="w-6 h-6" />
          <h1 className="text-lg font-semibold text-secondary-800 dark:text-dark-text">Realtime UI</h1>
        </div>
        <div className="flex items-center gap-3">
          <a 
            href="https://github.com/bigsk1/openai-realtime-ui" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
            aria-label="GitHub Repository"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
            </svg>
          </a>
          <DarkModeToggle />
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex flex-1 min-h-0"> 
        {/* Chat/Event Area */}
        <section className="flex flex-col flex-1 h-full min-w-0 bg-white dark:bg-dark-background"> 
          <div className="flex-1 p-4 overflow-y-auto space-y-3 scroll-smooth">
            {isSessionActive && <AudioWaveform isActive={isAISpeaking} />}
            <EventLog events={events} />
          </div>
          <div className="flex-shrink-0 p-3 pb-6 border-t border-secondary-200 dark:border-dark-border bg-white dark:bg-dark-surface">
            <SessionControls
              startSession={startSession}
              stopSession={stopSession}
              sendTextMessage={sendTextMessage}
              isSessionActive={isSessionActive}
            />
          </div>
        </section>

        {/* Tool Panel Area - Pass setter functions down */}
        <aside className="flex-shrink-0 w-[420px] h-full border-l border-secondary-200 dark:border-dark-border bg-secondary-50 dark:bg-dark-surface overflow-y-auto">
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
