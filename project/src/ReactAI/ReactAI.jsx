import "./ReactAI.css";
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import Editor from '@monaco-editor/react';
import * as Babel from '@babel/standalone';
import * as rollup from '@rollup/browser';
import dedent from 'dedent';
import path from 'path-browserify';
import JSZip from 'jszip';
import lottie from 'lottie-web';
import animationData1 from '../loadingAnimation.json'; 
import { getIndexHTML, indexJS } from "./static";
import Upload from "../Upload/Upload"
import bot from "../assets/ai.png";
import user from "../assets/user.png"
import logo from "../assets/logo.png"
import send from "../assets/send.svg";
import { FaBars } from 'react-icons/fa';
import { BsArrowRightCircle } from "react-icons/bs"
import { BsThreeDotsVertical } from 'react-icons/bs';
import { BsArrowRightCircleFill } from 'react-icons/bs';
import { BsQuestionCircle } from 'react-icons/bs';
import { SiReact } from 'react-icons/si';
import { BsCalculator, BsChevronDown } from 'react-icons/bs'
import { IoChevronBack, IoClose } from 'react-icons/io5'
import { useHasFilesStore, useShowEditorStore, useShowGPTStore } from "../activitiesStore"
import { openDatabase, storeFile, retrieveFilePaths, retrieveFileTree, retrieveFileByPath, retrieveTreeNodeByPath, resolvePath, resolvePackage } from "../fileUtils.js"

const binaryFileTypes = ['svg', 'png', 'jpg', 'jpeg'];
const staticFileTypes = {
  svg: fileData => `return "data:image/svg+xml;base64,${fileData}";`,
  png: fileData => `return "data:image/png;base64,${fileData}";`,
  jpg: fileData => `return "data:image/jpeg;base64,${fileData}";`,
  jpeg: fileData => `return "data:image/jpeg;base64,${fileData}";`,
  css: fileData => {
    let escaped = fileData.replace(/[\n]/g, '').replace(/"/g, '\\"');
    return dedent`
      var style = document.createElement('style');
      style.type = 'text/css';
      style.textContent = "${escaped}";
      document.head.appendChild(style);
    `;
  },
}

function OutsideClickDetector({ children, onOutsideClick }) {
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        // Click occurred outside the warning message div
        onOutsideClick();
      }
    }

    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [onOutsideClick]);

  return <div ref={wrapperRef}>{children}</div>;
}

const ReactAI = () => {
  // STATES
  var hasFiles = useHasFilesStore((state) => state.hasFiles);
  const setHasFiles = useHasFilesStore((state) => state.setHasFiles);

  var showEditor = useShowEditorStore((state) => state.showEditor);
  const setShowEditor = useShowEditorStore((state) => state.setShowEditor);

  var showGPT = useShowGPTStore((state) => state.showGPT);
  const setShowGPT = useShowGPTStore((state) => state.setShowGPT);

  const [hasRunOnce, setHasRunOnce] = useState(false)
  const [AIResults, setAIResults] = useState([])
  const [currentFrame, setCurrentFrame] = useState(0)
  const [editorCurrent, setEditorCurrent] = useState("")
  const [AIMode, setAIMode] = useState("ADD")
  const [warning, setWarning] = useState(true)
  const [warningText1, setWarningText1] = useState("Storing Project Files...")
  const [warningText2, setWarningText2] = useState("Please wait, this may take a few minutes")
  const [warningText3, setWarningText3] = useState("")
  const [dotsOpen, setDotsOpen] = useState(false)

  // Editor States 
  const [linePosition, setLinePosition] = useState({});
  const [lineEditOperation, setLineEditOperation] = useState({})
  const [editorObject, setEditorObject] = useState({})
  const [monacoObject, setMonacoObject] = useState({})
  const [editorScrollbar, setEditorScrollbar] = useState("hidden")
  // "visible"
  const [error, setError] = useState("")
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // AI States
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState("");
  const [GPTModel, setGPTModel] = useState("3.5-turbo")
  
  // File Upload States
  const [originalFile, setOriginalFile] = useState("");
  const [exportText, setExportText] = useState("Export")

  // Display References
  const editorRef = useRef(null);
  const frameRef = useRef(null);
  const loaderRef = useRef(null); 
  const formRef = useRef(null);
  const uploadRef = useRef(null);


  // DISPLAY FILE TREE
  const [tree, setTree] = useState({ "React Project": {}  })

  const [expandedNodes, setExpandedNodes] = useState({});

  const handleToggle = (nodePath) => {
    setExpandedNodes((prevState) => ({
      ...prevState,
      [nodePath]: !prevState[nodePath],
    }));
  };

  const renderTreeNode = (node, path) => {
    if (typeof node !== 'object' || node === true) {
      // Render a file node
      return <div className="tree-item" onClick={()=>{handleFileOpen(path)}} style={{color: "white", marginBottom: "3px", borderBottom: "0.3px solid #888", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis"}} key={path}>{path.split('/').pop()}</div>; 
    }

    // Render a folder node
    const isExpanded = expandedNodes[path] || false;

    return (
      <div key={path}>
        <div className="tree-item" style={{overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", borderBottom: "0.3px solid #888", marginBottom: "3px"}}  onClick={() => handleToggle(path)}>
          {isExpanded ? <BsChevronDown color="white" size={12}/> : <BsChevronDown style={{transform: "rotate(-90deg)"}} color="white" size={12}/>} {path.split('/').pop()} {/* Display only the folder name */}
        </div>
        {isExpanded && (
          <div className="nested-tree" style={{ marginLeft: 14}}>
            {Object.entries(node).map(([nodeName, nestedNode]) =>
              renderTreeNode(nestedNode, `${path}/${nodeName}`)
            )}
          </div>
        )}
      </div>
    );
  };

  // EDITOR FUNCTIONS
  async function handleEditorDidMount(editor, monaco) {
    
    const projectName = await handleBuild(); 
    // Once done building, open up App.js if it exists
    let appjs = null;
    try {appjs = await retrieveFileByPath(`${projectName}/src/App.js`)
    } catch {appjs = null}
     if (appjs !== null) {
      await handleFileOpen(`${projectName}/src/App.js`)
    }

    let decorationIds = [];
    editorRef.current = editor;
    editor.onMouseDown((e) => {
      // User clicked editor -> Set all states
      const position = e.target.position;
      const lineNumber = position.lineNumber === null? 0 : position.lineNumber;
      setLinePosition({ lineNumber: lineNumber - 1, column: 1 })
      setLineEditOperation({
        range: new monaco.Range(lineNumber, 0, lineNumber, 0),
        text:  "\n/*   Insert  AI generated code here   */\n\n",
        forceMoveMarkers: true,
      })
      setEditorObject(editor)
      setMonacoObject(monaco)

      // Add a CSS bar across top of selected line
      editorRef.current.deltaDecorations(decorationIds, []);
      const decoration = {
        range: new monaco.Range(lineNumber, 1, lineNumber, 1),
        options: {
          isWholeLine: true,
          className: 'line-bar-decoration',
        },
      };
      decorationIds = editorRef.current.deltaDecorations([], [decoration]);
      
    });
  }

  async function moneyyy(event) {
    const money = await handleSubmit(event);
  }

  function extractCode(string) {
    const codeRegex = /```jsx([\s\S]*)```/;
    const matches = string.match(codeRegex);
  
    if (matches && matches.length >= 2) {
      return matches[1].trim();
    }
    
    return string;
  }
  
  // AI GENERATION FUNCTIONS 
  async function handleSubmit(e) {
    e.preventDefault();

    // Check that there is a prompt
    if (prompt.length === 0) {
      giveWarning("Please Enter a Prompt", "The AI requires instructions to generate code...", "Self Close")
      return
    }
  
    // Check that there is a line selected
    if (Object.keys(lineEditOperation).length === 0 && AIMode === "ADD") {
      giveWarning("Please Select a Line", "ADD mode requires a specific location...", "Self Close")
      return
    }

    // Loading response animation
    setIsSubmitting(true)
    const container = document.getElementById("lottie-container-1"); 
    console.log("container", container)
    if (container) {
      const animation = lottie.loadAnimation({
        container: container,
        animationData: animationData1, 
        renderer: 'svg', 
        loop: true,
        autoplay: true, 
      });
    }

    setEditorCurrent(editorRef.current.getValue())
    
    const addCodeAtLineNumber = () => {
      if (editorRef.current) {
        const editOperation = lineEditOperation
        editorRef.current.executeEdits('addCode', [editOperation]);
      }
    };

    if (AIMode === "ADD") {
      addCodeAtLineNumber()
      setOriginalFile(editorRef.current.getValue())
    }

    // Create a full prompt for the AI
    let userMessage = "";
    console.log(AIMode)
    if (AIMode === "ADD") {
      userMessage = "Here is a jsx file from my React project. Please locate this comment in code that says exactly: {/*   Insert  AI generated code here   */}, and then return to me a snippet of code meant to replace that coment based on these instructions: Add "
      + prompt 
      + ". Please don't return the entire file. Only return the code to replace that comment! Make sure your response only contains code and nothing else. Here is the jsx file: \n\n" 
      + editorRef.current.getValue()
    } else if (AIMode === "ALTER") {
      userMessage = prompt 
      + ". Return the FULL jsx code for the file back to me. Here's the jsx file: " 
      + editorRef.current.getValue()
    } 
    console.log(userMessage)

    
    // setMessages((prevMessages) => [...prevMessages, { text: userMessage, isBot: false }]);
    setIsLoading(true);

    // Wait for AI return message and replace code in editor
    // try {
    //   let botMessage = await getMessage([...messages, { text: userMessage, isBot: false }]);
    //   botMessage = extractCode(botMessage)
    //   if (editorRef.current) {
    //     if (AIMode === "ADD") {
    //       botMessage = findAndReplace(editorRef.current.getValue(), botMessage)
    //     }
    //     let editor = editorRef.current;
    //     // let newPosition = editor.getPosition(); // Get current cursor position
    //     let editOperations = [{
    //       range: editor.getModel().getFullModelRange(),
    //       text: botMessage,
    //     }];

    //     editor.executeEdits("my-source", editOperations);
    //     editor.pushUndoStop();
    //     editorRef.current.setValue(botMessage)
    //   }
      
    //   setMessages((prevMessages) => [...prevMessages, { text: botMessage, isBot: true }]);
    // } catch (error) {
    //   console.error(error);
    //   setMessages((prevMessages) => [...prevMessages, { text: "Something went wrong...", isBot: true }]);
    // } 

  
      const requests = [
        getMessage([{ text: userMessage, isBot: false }]),
        getMessage([{ text: userMessage, isBot: false }]),
        getMessage([{ text: userMessage, isBot: false }]),
        getMessage([{ text: userMessage, isBot: false }])
      ];

      try {
        let editorCode = editorRef.current.getValue()
        const results = await Promise.all(requests);
        let AIArray = [];
        for (let i=0;i<requests.length;i++) {
          let response = results[i]
          if (AIMode === "ALTER") {response = extractCode(response)}
          let newContent = "";
          if (AIMode === "ADD") {newContent = findAndReplace(editorCode, response)}
          if (AIMode === "ALTER") {newContent = response}
          AIArray.push(newContent)
          if (editorRef.current) {
            if (i === 0) {
              editorRef.current.setValue(newContent);}
              setCurrentFrame(1)
            }
        }
        setAIResults(AIArray)
      } catch (error) {
        console.error('Error fetching data:', error);
        setIsSubmitting(false)
      }

    // try {
    //   // let botMessage = await getMessage([...messages, { text: userMessage, isBot: false }]);
    //   let botMessage = await getMessage([{ text: userMessage, isBot: false }]);
    //   console.log(botMessage)
    //   if (AIMode === "ALTER") {botMessage = extractCode(botMessage)}
    //   console.log(botMessage)
    //   if (editorRef.current) {
    //     let newContent = "";
    //     if (AIMode === "ADD") {newContent = findAndReplace(editorRef.current.getValue(), botMessage)}
    //     if (AIMode === "ALTER") {newContent = botMessage}
    //     editorRef.current.setValue(newContent);
    //     // let editOperations = [{
    //     //   range: editorRef.current.getModel().getFullModelRange(),
    //     //   text: botMessage,
    //     // }];

    //     // editorRef.current.executeEdits("my-source", editOperations);
    //     // editorRef.current.pushUndoStop();
    //     // editorRef.current.setValue(botMessage)

    //     // let editOperations = [{
    //     //   range: editor.getModel().getFullModelRange(),
    //     //   text: botMessage,
    //     // }];

    //     // editor.executeEdits("my-source", editOperations);
    //     // editor.pushUndoStop();
    //   }
    //   // setMessages((prevMessages) => [...prevMessages, { text: botMessage, isBot: true }]);
    // } catch (error) {
    //   console.error(error);
    //   // setMessages((prevMessages) => [...prevMessages, { text: "Something went wrong...", isBot: true }]);
    // } 



    // Auto re-format the new code
    monacoAutoformat()
    const moneyyy = await handleBuild(); 
    setHasRunOnce(true)
  };
  
  async function getMessage(messages) {
    const formattedMessages = messages.map(message => ({
      role: message.isBot ? "assistant" : "user",
      content: message.text
    }))
    const options = {
      method: 'POST',
      headers: {
        'Authorization': "Bearer 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",   
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: `gpt-${GPTModel}`,
        messages: formattedMessages,
        temperature: 0.8,
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
    let message = {}
    if (data.choices[0].message !== undefined) {message = data.choices[0].message}
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

  function findAndReplace(code, replacement) {
    const regex = /\/\*\s*Insert\s*AI\s*generated\s*code\s*here\s*\*\/\s*/;
    const updatedCode = code.replace(regex, replacement + "\n\n");
    return updatedCode;
  }

  function monacoAutoformat() {
    const formatAction = editorObject.getAction('editor.action.formatDocument');
    const autoFormatCode = () => {
      if (formatAction) {formatAction.run()}
    };
    autoFormatCode();
    editorObject.addCommand(monacoObject.KeyMod.CtrlCmd | monacoObject.KeyCode.KEY_F, autoFormatCode);
    editorObject.addCommand(monacoObject.KeyMod.Shift | monacoObject.KeyMod.Alt | monacoObject.KeyCode.KEY_F, autoFormatCode);
  }

  async function askGPT(prompt) {
    if (prompt.length === 0) return null
    try {
      return await getMessage([{ text: prompt, isBot: false }])
    } catch (error) {
      console.log("API key is invalid");
      return null
    }
  };

  // BUILD FUNCTION
  const handleBuild = async () => {
    try {
      console.log("getting file paths")
      let filePaths = await retrieveFilePaths();
      console.log("got file paths")
      let fileTree = await retrieveFileTree();
      console.log("got file tree")

      let projectName = filePaths[0].split("/")[0];


      // let packageJsons = filePaths.filter(x => x.startsWith(`${projectName}/node_modules/`) && x.endsWith('/package.json')).slice(0, 10);
      // console.log(`Parsing ${packageJsons.length} package.json files`);
      
      // let mainFilePaths = [];
      // for (let packageJson of packageJsons) {
      //   let modulePath = path.dirname(packageJson);
      //   let module = modulePath.slice(`${projectName}/node_modules/`.length)
      //   try {
      //     let packageJsonData = await retrieveFileByPath(packageJson);
      //     let mainPath = JSON.parse(packageJsonData).main;
      //     if (!mainPath) {
      //       continue;
      //     }
      //     try {
      //       let mainAbsPath = path.join(modulePath, mainPath);
      //       mainAbsPath = await resolvePath(fileTree, mainAbsPath);
      //       await retrieveFileByPath(mainAbsPath)
      //       mainFilePaths.push(mainAbsPath)
      //     } catch {
      //       console.log(`Couldn't find main file at ${path.join(modulePath, mainPath)} for module ${module}, skipping...`);
      //       continue;
      //     }
      //   } catch {
      //     console.log(`Couldn't find package.json for module ${module}, skipping...`);
      //     continue;
      //   }
      // };

      // console.log("Done scanning package.json files")

      let reactRegex = /import\s+React(?:\s*,\s*\{\s*([A-Za-z0-9$_,\s]+?)\s*\})?\s+from\s+['"]react['"]/;

      let srcFiles = filePaths.filter(x => x.startsWith(`${projectName}/src/`) && (x.endsWith('.js') || x.endsWith('.jsx')));
      let modules = [];
      for (let filePath of srcFiles) {
        let fileData = await retrieveFileByPath(filePath)
        let moduleCode =  Babel.transform(fileData, { presets: [["env", {"modules": false}], "react"] }).code;
        if (!reactRegex.test(moduleCode)) {
          moduleCode = 'import React from "react";\n' + moduleCode;
        }
        modules.push({
          name: filePath,
          code: moduleCode,
          isEntry: filePath === `${projectName}/src/index.js`
        });
      }

      let moduleById = {};
      modules.forEach(module => {
        moduleById[module.name] = module;
      });

      let inputOptions = {
        input: [`${projectName}/src/index.js`],
        plugins: [{
          resolveId (importee, importer) {
            // console.log("IMPORTING FILE", importer, importee);
            let fileType = importee.split('.').slice(-1)[0];
            if (!importer) return importee;
            if (importee in moduleById) return importee;
            if (importee[0] !== '.') return false;
            if (fileType in staticFileTypes) return false;

            let filePath = path.join(path.dirname(importer), importee);
            let resolved = resolvePath(fileTree, filePath);
            if (!(resolved in moduleById)) {
              throw new Error(`Could not resolve '${importee}' from '${importer}'`);
            }
            return resolved;
          },
          load: function (id) {
            return moduleById[id].code;
          }
        }],
      }

      let rolledUp = await rollup.rollup(inputOptions);
      let bundle = await rolledUp.generate({});
      let bundleCode = bundle.output[0].code;
      // console.log("BUNDLE");
      // console.log(bundle.output[0]);
      // console.log(bundle.output[0].code);

      let staticDependencies = {}
      let bundleDependencies = {}
      for (let name of bundle.output[0].imports) {
        let fileType = name.split('.').slice(-1)[0]
        if (fileType in staticFileTypes) {
          staticDependencies[name] = { type: fileType };
        }
        else {
          let modulePath = await resolvePackage(fileTree, path.join(projectName, 'node_modules', name));
          bundleDependencies[modulePath] = [name];
        }
      };
  
      let dependencies = {};
      for (let key in bundleDependencies) {
        dependencies[key] = [...bundleDependencies[key]];
      }
      let dependencyQueue = Object.keys(dependencies);
      while (dependencyQueue.length) {
        let fileName = dependencyQueue.shift();
        let contents = await retrieveFileByPath(fileName);
        let regexp = /require\(['"](.+?)['"]\)/g
        let results = contents.matchAll(regexp);
        for (let result of results) {
          let requirePath;
          try {
            // Check if the dependency is a node submodule (local node_modules)
            requirePath = path.join(path.dirname(fileName), result[1]);
            requirePath = await resolvePackage(fileTree, requirePath);
            await retrieveFileByPath(requirePath);
          } catch {
            // Fall back to the top-level node_modules
            requirePath = path.join(projectName, 'node_modules', result[1]);
            requirePath = await resolvePackage(fileTree, requirePath);
            await retrieveFileByPath(requirePath);
          }
          if (!(requirePath in dependencies)) {
            dependencyQueue.push(requirePath);
            dependencies[requirePath] = [];
          }
          dependencies[requirePath].push(result[1]);
        }
      }

      // Deduplicate
      for (let key in dependencies) {
        dependencies[key] = Array.from(new Set(dependencies[key]));
      }

      console.log("Done creating dependency tree");
      console.log(dependencies);

      let code = dedent`\n
        var __modules__ = {};
        function define(names, module) {
          for (var i = 0; i < names.length; i++) {
            __modules__[names[i]] = {value: null, init: module};
          }
        }
        function require(name) {
          if (!__modules__[name]) {
            throw new Error("module " + name + " could not be imported");
          }
          else if (!__modules__[name].value) {
            __modules__[name].value = __modules__[name].init();
          }
          return __modules__[name].value;
        }
      `

      for (let key in dependencies) {
        let moduleCode = await retrieveFileByPath(key);
        let moduleNames = dependencies[key].map(name =>`"${name}"`).join(', ')
        code += dedent`\n
          define([${moduleNames}], function() {
            var exports = {};
            var module = {exports: exports};
          ` + moduleCode + dedent`\n
            return module.exports;
          });
        `;
      }

      for (let key in staticDependencies) {
        let fileType = staticDependencies[key].type;
        let fileData = await retrieveFileByPath(key, binaryFileTypes.includes(fileType));
        let body = "return null;";
        if (fileType in staticFileTypes) {
          body = staticFileTypes[fileType](fileData);
        }
        code += dedent`\n
          define(["${key}"], function() {
            ${body}
          });
        `;
      }

      let simpleImportRegex = /import\s+['"](.*?)['"];/g;
      let defaultImportRegex = /import\s+([A-Za-z0-9$_]+?)\s+from\s+['"](.*?)['"];/g;
      let destructuringImportRegex = /import\s+\{\s*([A-Za-z0-9$_, ]+?)\s*\}\s+from\s+['"](.*?)['"];/g;
      let combinedImportRegex = /import\s+([A-Za-z0-9$_]+?)\s*,\s*\{\s*([A-Za-z0-9$_,\s]+?)\s*\}\s+from\s+['"](.*?)['"];/g;

      let importCode = ''
      for (let result of bundleCode.matchAll(simpleImportRegex)) {
        importCode += `\nrequire("${result[1]}");\n`;
      }
      for (let result of bundleCode.matchAll(defaultImportRegex)) {
        importCode += `\nvar ${result[1]} = require("${result[2]}");\n`;
      }
      for (let result of bundleCode.matchAll(destructuringImportRegex)) {
        importCode += `\nvar {${result[1]}} = require("${result[2]}");\n`;
      }
      for (let result of bundleCode.matchAll(combinedImportRegex)) {
        importCode += dedent`\n
          var ${result[1]} = require("${result[3]}");
          var {${result[2]}} = require("${result[3]}");
        `;
      }

      bundleCode = bundleCode.replaceAll(simpleImportRegex, '');
      bundleCode = bundleCode.replaceAll(defaultImportRegex, '');
      bundleCode = bundleCode.replaceAll(destructuringImportRegex, '');
      bundleCode = bundleCode.replaceAll(combinedImportRegex, '');
      bundleCode = bundleCode.trim();
      bundleCode = importCode + bundleCode;

      code += bundleCode;
      const indexHTML = getIndexHTML(code);
      if (code.length > 0) {
        setWarning(false)
      }

      const iframe = document.createElement('iframe');
      iframe.setAttribute('width', '100%');
      iframe.setAttribute('height', '100%');
      iframe.setAttribute('frameborder', '100%');
      frameRef.current.innerHTML = '';
      frameRef.current.appendChild(iframe);
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(indexHTML);
      iframe.contentWindow.document.close();

      clearUserPrompt();
      setPrompt("")
      setLineEditOperation({})
      setIsSubmitting(false)
      return projectName
    } catch (error) {
      console.log(error)
      giveWarning("Error", "View console for error message from your code: Right Click > Inspect > Console", "User Close")
      let location = await askGPT("Here's an error from my React app. Return back to me one of two things. Return 'App.js' if you're unsure what file is causing the error. If you think you know the name of the file causing the error, then return the name of that file back to me, and NOTHING else. Here is the error message: " + error)
      console.log(location)
      setWarningText3("AI suggests: " + location)
      setIsSubmitting(false)
    }
  }

  // MONACO EDITOR FUNCTIONS
  const [openFiles, setOpenFiles] = useState([ ])

  function handleEditorChange(index) {
    if (openFiles.length > 0) {
      let openFilesCopy = openFiles
      openFilesCopy[index].value = editorRef.current.getValue()
      setOpenFiles(openFilesCopy)
      storeFile(openFilesCopy[index].path, openFilesCopy[index].value)
    }
  };

  const [sidebar, setSidebar] = useState(false);
  const [openFileNum, setOpenFileNum] = useState(null);

  function handleSidebar() {
    setSidebar(prevSidebar => !prevSidebar);
  }

  let currentFile;
  function closeFile(fileNum) {
    const isCurrentlyOpenFile = fileNum === openFileNum;
    
    setOpenFiles(prevOpenFiles => {
      const newArray = prevOpenFiles.filter((_, index) => index !== fileNum);
      if (isCurrentlyOpenFile) {
        setOpenFileNum(null); 
        currentFile = null
        setFile(null)
        // if (editorRef.current) {
        //   editorRef.current.setValue("");
        // }
      }
      return newArray;
    });
  }

  currentFile = openFiles[openFileNum];
  const [file, setFile] = useState(currentFile)

  async function handleSidebar() {
    let sideOpen = sidebar;
    setSidebar(!sideOpen)
    if (!sideOpen) {
      let fileTree = await retrieveFileTree()
      setTree(fileTree)
    }
  }

  async function handleFileOpen(path) {
    let fileData = await retrieveFileByPath(path)
    let found = false
    for (let i=0;i<openFiles.length;i++) {
      if (openFiles[i].path === path) {
        // File is already open
        found = true
        setOpenFileNum(i)
        setFile( openFiles[i] )
        
      }
    }

    if (!found) {
      // Open file
      let fileNames = path.split("/")
      let fileName = fileNames[fileNames.length - 1]
      let fileType = fileName.split(".")
      let type = "javascript";
      if (fileType[1] === "html") {type="html"}
      if (fileType[1] === "js") {type="javascript"}
      if (fileType[1] === "jsx") {type="javascript"}
      if (fileType[1] === "ts") {type="typescript"}
      if (fileType[1] === "css") {type="css"}
      if (fileType[1] === "json") {type="json"}

      setOpenFiles( prev => [{
        name: fileName,
        language: type,
        value: fileData,
        path: path
      }, ...prev])
      setFile({
        name: fileName,
        language: type,
        value: fileData,
        path: path
      })
      setOpenFileNum(0)
    } 
  }

  function clearUserPrompt() {
    const inputElement = document.getElementById("userPrompt");
    if (inputElement) {
      inputElement.value = "";
    }
  }

  // DISPLAY
  async function handleFrameChange(frameNumber) {
    if (editorRef.current) {
      if (frameNumber === 0) {editorRef.current.setValue(editorCurrent)} 
      else {editorRef.current.setValue(AIResults[frameNumber - 1]); }
      setCurrentFrame(frameNumber)
      monacoAutoformat()
      const moneyyy = await handleBuild(); 
    }
  }

  function giveWarning(topText, bottomText, type) {
    setWarning(true);
    setWarningText1(topText);
    setWarningText2(bottomText);
  
    if (type === "Self Close") {
      setTimeout(function () {
        setWarning(false);
        setWarningText1("Storing Project Files...");
        setWarningText2("Please wait, this may take a few minutes");
        setWarningText3("")
      }, 3800);
    }
  }



  // Close the alert
  let outsideClicks = 0;
  function handleOutsideClick() {
    if (outsideClicks !== 0) {
      setWarningText3("")
      setWarning(false)
      setDotsOpen(false)
      outsideClicks = 0;
    } else {outsideClicks += 1}
  };

  // Close the options menu
  let outsideClicks2 = 0;
  function handleOutsideClick2() {
    if (outsideClicks2 !== 0) {
      setDotsOpen(false)
      outsideClicks2 = 0;
    } else {outsideClicks2 += 1}
  };

  function switchModel() {
    if (GPTModel === "4") {
      setGPTModel("3.5-turbo")
    } else {setGPTModel("4")}
  }

  // EXPORT
  async function handleExport() {
    setIsUploading(true)
    setExportText("Exporting Zip...");
    const db = await openDatabase();
    const zip = new JSZip();
  
    const countTransaction = db.transaction(["files"], "readonly");
    const countObjectStore = countTransaction.objectStore("files");
    const countRequest = countObjectStore.count();
  
    countRequest.onsuccess = async event => {
      const fileCount = event.target.result;
      let number = 0;
      let projectName = "";
  
      const transaction = db.transaction(["files"], "readonly");
      const objectStore = transaction.objectStore("files");
      const request = objectStore.openCursor();
  
      request.onsuccess = async event => {
        const cursor = event.target.result;
        if (cursor) {
          const fileData = cursor.value.content;
          const fileName = cursor.value.filepath;
  
          if (number === 0) {
            projectName = fileName.split("/")[0];
          }
          number += 1;
          if (number % 370 === 0) {
            setProgress((number / fileCount) * 100)
           }
  
          if (!fileName.startsWith(`${projectName}/node_modules`)) {
            if (fileData !== undefined) {
              zip.file(fileName, fileData);
            }
          }
  
          cursor.continue();
        } else {
          try {
            if (Object.keys(zip.files).length > 0) {
              const content = await zip.generateAsync({ type: "blob" });
              const zipFileName = `${projectName}.zip`;
  
              const downloadLink = document.createElement("a");
              downloadLink.href = URL.createObjectURL(content);
              downloadLink.download = zipFileName;
  
              document.body.appendChild(downloadLink);
              downloadLink.click();
              document.body.removeChild(downloadLink);
  
              console.log("Export successful!");
              setExportText("Export");
              setIsUploading(false)
              setProgress(0)
            } else {
              console.log("No files to export.");
              setExportText("Export");
              setIsUploading(false)
              setProgress(0)
            }
          } catch (error) {
            console.error("An error occurred while exporting the project.", error);
            setExportText("Export");
            setIsUploading(false)
            setProgress(0)
          }
        }
      };
  
      request.onerror = event => {
        console.error("An error occurred while exporting the project.", event.target.error);
        setExportText("Export");
      };
    };
  
    countRequest.onerror = event => {
      console.error("An error occurred while counting the files.", event.target.error);
      setExportText("Export");
    };
  }

  return (
    <div style={{width: "100vw", marginTop: "60px", height: "calc(100vh - 60px)", position: "fixed"}}>
      
      {warning && <div style={{position: "absolute", height: "100%", width: "100vw", zIndex: 999}}>
        <div style={{ppointerEvents: warning? "none" : "all", position: "absolute", height: "100%", width: "100%", backgroundColor: "black", opacity: 0.8}}></div>
        <div style={{position: "absolute", height: "100%", width: "100%", display: "flex", justifyContent: "center", alignItems: "center"}}>
          <OutsideClickDetector onOutsideClick={() => {handleOutsideClick()}}>
            <div style={{position: "relative", marginTop: "-15vh", height: "260px", width: "400px", borderRadius: "15px", backgroundColor: "black", border: "1px solid white", display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", gap: "4px"}}>
              <div className="hover-dim" style={{position: "absolute", top: "10px", right: "10px", cursor: "pointer"}} onClick={()=>{setWarning(false); setWarningText3("")}} ><IoClose color="white" size={35}/></div>
              <div style={{width: "80%", color: "white", fontSize: "30px", fontWeight: "bold", textAlign: "center"}}>
                {warningText1}
              </div>
              <div style={{width: "80%", color: "#999", fontSize: "20px", fontWeight: "100", textAlign: "center"}}>
                {warningText2}
              </div>
              <div style={{width: "80%", color: "white", fontSize: "20px", fontWeight: "100", textAlign: "center"}}>
                {warningText3}
              </div>
            </div>
          </OutsideClickDetector>
        </div>
      </div>}

     
      {dotsOpen &&  <OutsideClickDetector onOutsideClick={() => {handleOutsideClick2()}}>
        <div style={{position: "absolute", right: 0, height: "calc(100% - 41px)", width: "50%", bottom: "41px", backgroundColor: "black", borderLeft: "1px solid white", zIndex: 998, display: "flex", flexDirection: "column", gap: "10px", padding: "20px 17px", paddingTop: "30px"}}>
          <div className="hover-dim" style={{position: "absolute", top: "10px", right: "10px", cursor: "pointer"}} onClick={()=>{setDotsOpen(false)}} ><IoClose color="white" size={35}/></div>
          
          <div style={{color: "white", fontSize: "28px", fontWeight: "600"}}>Your Project</div>     
         
          <div style={{width: "100%"}}>
            <button style={{width: "100%", whiteSpace: "nowrap", padding: "5px 10px", border: "1px solid white", color: "white", borderRadius: "7px", fontSize: "14px"}} 
              className="prompt-button"
              onClick={()=>{handleExport()}}>
                {exportText}
                {isUploading && <div style={{ width: "100%", margin: "3px 0"}} className="progress-bar">
                <div className="progress" style={{ width: `${progress}%` }}>
                </div>
                </div>}
            </button> 

          </div>
     

          <div style={{marginTop: "15px", color: "white", fontSize: "16px", fontWeight: "400"}}>Current Model</div>     
         
          <button style={{whiteSpace: "nowrap",padding: "5px 10px", border: "1px solid white", color: "white", borderRadius: "7px", fontSize: "14px"}} 
            className="prompt-button"
            onClick={()=>{switchModel()}}>
             gpt-{GPTModel}
          </button> 

        </div>
      </OutsideClickDetector>}

      <div  style={{zIndex: 1, width: "50vw", height: "calc(100% - 41px)", position: "absolute"}}>
        <div style={{height: "100%", width: "100%", position: "absolute", display: "flex", flexDirection: "row"}}> 
          <div style={{width: sidebar? "150px" : "50px", height: "100%", backgroundColor: "black", borderRight: "0.1px solid white", display: "flex", flexDirection: "column", alignItems: "center"}}>
            {sidebar === false && <FaBars color="white" size={"21px"} style={{marginTop: "10px", cursor: "pointer"}} onClick={()=>{handleSidebar()}}/>}
            {sidebar && <IoChevronBack color="white" size={"25px"} style={{marginTop: "8px", marginLeft: "-112px", cursor: "pointer"}} onClick={()=>{handleSidebar()}}/>}
            {sidebar && <div style={{overflow: "scroll", position: "absolute", width: sidebar? "130px" : 0, height: "calc(100% - 40px)", backgroundColor: "black", borderLeft: "0.1px solid white", marginTop: "40px", cursor: "pointer"}}>
            <div className="file-tree" style={{ color: "white", padding: "3px 8px"}}>
              {Object.entries(tree).map(([nodeName, node]) =>
                renderTreeNode(node, nodeName)
              )}
            </div>
            </div>}
          </div>
          <div style={{height: "100%", width: sidebar? "calc(100% - 150px)" : "calc(100% - 50px)"}}>
            <div className="hide-scroll" style={{zIndex: 3,  height: "25px", width: "100%", borderBottom: "0.1px solid white", backgroundColor: "black", display: "flex", flexDirection: "row", overflow: "scroll"}}>
              
              {openFiles.map((item, index) => (
                 <div 
                  key={index}
                  className="file-item"
                  onClick={() => {
                    setOpenFileNum(index); 
                    let currentFile = openFiles[index] 
                    setFile(currentFile)}}
                  style={{opacity: openFileNum === index? 1 : 0.6, height: "100%", width: "100px", minWidth: "100px", backgroundColor: "transparent", borderRight: "0.1px solid white", display: "flex", alignItems: "center", userSelect: "none", cursor: "pointer"}}>
                  <div style={{overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", backgroundColor: "transparent", width: "calc(100% - 22px)", height: "auto"}}>
                    <p style={{color: "white", marginLeft: "10px", fontSize: "15px"}}>{item.name}</p>
                  </div>
                  <div className="file-x" style={{position: "absolute", marginLeft: "82px", width: "15px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "transparent", opacity: 0.35}}>
                    <IoClose color="white" size={"19px"} onClick={()=>{closeFile(index)}}/>
                  </div>
               </div>
              ))}

            </div>
            <div onClick={()=>{setDotsOpen(false)}} style={{height: "calc(100% - 25px)", paddingTop: "6px", backgroundColor: "black"}}>
              <Editor
                onChange={()=>{let fileOpened = openFileNum; handleEditorChange(fileOpened)}}
                height="100%"
                defaultLanguage = {openFileNum === null ?  "javascript" : file.language}
                value = {openFileNum === null ?  "" : file.value}
                path = {openFileNum === null ?  "/" : file.name}
                theme="hc-black"
                onMount={handleEditorDidMount}
                options={{
                  fontSize: 13, 
                  lineNumbers: "on", 
                  lineNumbersMinChars: 3, 
                  wordWrap: "off",  
                  scrollBeyondLastLine: false,  
                  scrollbar: {
                    vertical: {editorScrollbar},
                    horizontal: {editorScrollbar},
                  },
                }}
                />
              </div>
          </div>
        </div>
      </div>

      <div ref={frameRef} style={{width: "50vw", marginLeft: "50vw", height: "calc(100% - 41px)", backgroundColor: "black", borderLeft: "0.1px solid white"}}>
      </div>

      <div style={{zIndex: 2, backgroundColor: "black", borderTop: "0.1px solid white", position: "absolute", bottom: 0, left: 0, paddingLeft: "14px", height: "40px", width: "100vw", display: "flex", flexDirection: "row", borderTop: "0.1px solid black", gap: "6px", alignItems: "center"}}>
          <div style={{fontSize:"19px", height: "100%", display: "flex", alignItems: "center"}}><BsQuestionCircle 
          className="hover-dim question" 
          color="#999"
          style={{cursor: "pointer"}}/></div>
          <div onClick={()=>{
            setAIMode(AIMode === "ADD"? "ALTER" : "ADD")
          }} style={{color: "white", cursor: "pointer", marginLeft: "12px", fontWeight: "500", opacity: 0.85, border: "0.5px solid #999", borderRadius: "6px", padding: "3px 8px"}}>
            {AIMode}:
          </div>
          <input   
            id="userPrompt"
            type="text" 
            placeholder='Enter a prompt...'
            onChange={(event) => {
              setPrompt(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                moneyyy(event);
              }
            }}
            style={{ width: "calc(100% - 200px)", border: "none", outline: "none", fontSize: "17px", backgroundColor: "black", color: "white", marginLeft: "6px" }}
          />

          <div id="lottie-container-1" style={{display: isSubmitting? "block" : "none", pointerEvents: "none", backgroundColor: "transparent", height: "100px", minWidth: "100px", width: "100px", padding: 0, margin: 0, marginRight: "-25px"}}></div>
          
          {!isSubmitting && <div style={{fontSize: "27px", height: "100%", width: "auto", display: "flex", alignItems: "center"}}>
            <BsArrowRightCircle ref={formRef} 
              title="Generate" color="white" size={"27px"}
              onClick={handleSubmit}
              className="hover-dim"
              style={{marginLeft: "10px", cursor: "pointer", marginRight: "6px"}}
            /> 
          </div>}
          <div style={{fontSize: "27px", height: "100%", width: "auto", display: "flex", alignItems: "center"}}>
            <SiReact 
              title="Display" color="white" size={"27px"}
              style={{cursor: "pointer"}}
              className="hover-dim"
              onClick={handleBuild}
            /> 
          </div>
          {hasRunOnce && <button style={{marginLeft: "15px", opacity: currentFrame === 1? 1 : 0.7, padding: "5px 10px", border: "1px solid white", color: "white", borderRadius: "4px", fontSize: "12px"}} 
            className="prompt-button"
            onClick={()=>{handleFrameChange(1)}}>
            1st 
          </button>}
          {hasRunOnce && <button style={{opacity: currentFrame === 2? 1 : 0.7, padding: "5px 10px", border: "1px solid white", color: "white", borderRadius: "4px", fontSize: "12px"}} 
            className="prompt-button"
            onClick={()=>{handleFrameChange(2)}}>
            2nd
          </button>}
          {hasRunOnce && <button style={{opacity: currentFrame === 3? 1 : 0.7, padding: "5px 10px", border: "1px solid white", color: "white", borderRadius: "4px", fontSize: "12px"}} 
            className="prompt-button"
            onClick={()=>{handleFrameChange(3)}}>
            3rd 
          </button> }
          {hasRunOnce && <button style={{opacity: currentFrame === 4? 1 : 0.7, padding: "5px 10px", border: "1px solid white", color: "white", borderRadius: "4px", fontSize: "12px"}} 
            className="prompt-button"
            onClick={()=>{handleFrameChange(4)}}>
            4th
          </button> }
          {hasRunOnce && <button title="Revert" style={{marginLeft: "15px", border: "1px solid white", color: "white", borderRadius: "6px", fontSize: "12px", display: "flex", justifyContent: "center", alignItems: "center"}} 
            className="prompt-button"
            onClick={()=>{handleFrameChange(0)}}>
            <IoChevronBack color="white" size={"25px"} style={{marginLeft: "-3px"}}/>
          </button>}

          <div style={{fontSize: "19px", height: "100%", width: "auto", display: "flex", alignItems: "center"}}>
          <BsThreeDotsVertical title="Options" 
            className="hover-dim" color="white" 
            style={{marginRight: "8px", cursor: "pointer"}}
            onClick={() => {setDotsOpen(!dotsOpen)}}
          />
          </div>
        </div>
    </div>
  
);
};

export default ReactAI;