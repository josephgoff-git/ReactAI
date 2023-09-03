import React, { useRef, useState } from 'react';
import "./GPT.css";
import GPTlogo from "../assets/ai.png";
import user from "../assets/user.png"
import logo from "../assets/logo.png"
import send from "../assets/send.svg";
import Header from "../Header/Header"
import { LuSend } from "react-icons/lu"
import { useHasFilesStore, useShowEditorStore, useShowGPTStore } from "../activitiesStore"

// height: -webkit-fill-available

const GPT = () => {
  var hasFiles = useHasFilesStore((state) => state.hasFiles);
  const setHasFiles = useHasFilesStore((state) => state.setHasFiles);

  var showEditor = useShowEditorStore((state) => state.showEditor);
  const setShowEditor = useShowEditorStore((state) => state.setShowEditor);

  var showGPT = useShowGPTStore((state) => state.showGPT);
  const setShowGPT = useShowGPTStore((state) => state.setShowGPT);

  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState("")
  const loaderRef = useRef(null); 
  const formRef = useRef(null);

  const handleTextareaKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current.requestSubmit();
    }
  };
        
  function startLoadingAnimation() {
    if (!isLoading) {
      setIsLoading(true);
      loaderRef.current = setInterval(() => {
        setLoading(prevLoading => prevLoading.length < 3 ? prevLoading + "." : "");
      }, 160);
    }
  }

  function stopLoadingAnimation() {
    setIsLoading(false);
    clearInterval(loaderRef.current);
    setLoading("");
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    const form = e.target;
    const data = new FormData(form);

    const userMessage = data.get("prompt");
    setMessages((prevMessages) => [...prevMessages, { text: userMessage, isBot: false }]);
    form.reset();

    startLoadingAnimation(); // Start the loading animation
    setIsLoading(true);

    try {
      const botMessage = await getMessage([...messages, { text: userMessage, isBot: false }]);
      setMessages((prevMessages) => [...prevMessages, { text: botMessage, isBot: true }]);
    } catch (error) {
      console.error(error);
      setMessages((prevMessages) => [...prevMessages, { text: "Something went wrong...", isBot: true }]);
    } finally {
      stopLoadingAnimation();
    }
  };

  async function getMessage(messages) {
    const formattedMessages = messages.map(message => ({
      role: message.isBot ? "assistant" : "user",
      content: message.text
    }))
    const options = {
      method: 'POST',
      headers: {
        'Authorization': "Bearer ",
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // model: "gpt-4",
        model: "gpt-3.5-turbo",
        messages: formattedMessages,
        // max_tokens: 1500,
        // functions: [
        //   {
        //     "name": "write_diff",
        //     "description": "Generate a code diff using the supplied arguments",
        //     "parameters": {
        //       "type": "object",
        //       "properties": {
        //         "code": {
        //           "type": "string",
        //           "description": "The code you want to write"
        //         },
        //       },
        //       "required": ["code"]
        //     }
        //   }
        // ]
      })
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', options);
    const data = await response.json();
    const message = data.choices[0].message;
    if (message.content) {
      return message.content;
    }
    else if (message.function_call) {
      try {
        const result = JSON.parse(message.function_call.arguments);
        return result.code
      } catch {
        return message.function_call.arguments;
      }
    } 
    else {
      return "NO RESPONSE";
    }
  }

  return (
    <div id="app">
      <div id="chat_container">
        {messages.map((message, index) => (
          <div className={`wrapper ${message.isBot ? 'ai' : ''}`} key={index}>
            <div className="chat">
              <div className="profile">
                <img src={message.isBot ? GPTlogo : user} alt={message.isBot ? 'bot' : 'user'} />
              </div>
              <div className="message">{message.text}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="wrapper ai">
            <div className="chat">
              <div className="profile">
                <img src={GPTlogo} alt="bot"/>
              </div>
              <div className="message">{loading}</div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} ref={formRef}>
        <textarea onKeyPress={handleTextareaKeyPress} style={{ resize: "none" }} name="prompt" rows="1" cols="1" placeholder="Ask me something..."></textarea>
        <button type="submit" style={{paddingRight: "10px"}}>
          <LuSend color="white" fontSize={25} style={{transform: "rotate(45deg)"}}/>
        </button>
      </form>
    </div>
  );
};

export default GPT;