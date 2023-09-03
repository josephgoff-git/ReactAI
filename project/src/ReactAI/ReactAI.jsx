import "./ReactAI.css";
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import Editor from '@monaco-editor/react';
import * as Babel from '@babel/standalone';
import * as rollup from '@rollup/browser';
import dedent from 'dedent';
import path from 'path-browserify';
import JSZip from 'jszip';
import { getIndexHTML, indexJS } from "./static";
import Upload from "../Upload/Upload"
import bot from "../assets/ai.png";
import user from "../assets/user.png"
import logo from "../assets/logo.png"
import send from "../assets/send.svg";
import { FaBars } from 'react-icons/fa';
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

const ReactAI = () => {
  // STATES
  var hasFiles = useHasFilesStore((state) => state.hasFiles);
  const setHasFiles = useHasFilesStore((state) => state.setHasFiles);

  var showEditor = useShowEditorStore((state) => state.showEditor);
  const setShowEditor = useShowEditorStore((state) => state.setShowEditor);

  var showGPT = useShowGPTStore((state) => state.showGPT);
  const setShowGPT = useShowGPTStore((state) => state.setShowGPT);

  const [AIResults, setAIResults] = useState([])
  const [currentFrame, setCurrentFrame] = useState(0)
  const [editorCurrent, setEditorCurrent] = useState("")

  const [AIMode, setAIMode] = useState("ADD")
  // DISPLAY FILE TREE
  const [tree, setTree] = useState({
    "React Project": {}
  })

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
      return <div className="tree-item" onClick={()=>{handleFileOpen(path)}} style={{color: "white", marginBottom: "3px", borderBottom: "0.3px solid #888", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis"}} key={path}>{path.split('/').pop()}</div>; // Display only the file/folder name
    }

    // Render a folder node
    const isExpanded = expandedNodes[path] || false;

    return (
      <div key={path}>
        <div className="tree-item" style={{overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", borderBottom: "0.3px solid #888", marginBottom: "3px"}}  onClick={() => handleToggle(path)}>
          {isExpanded ? <BsChevronDown color="white" size={12}/> : <BsChevronDown style={{transform: "rotate(-90deg)"}} color="white" size={12}/>} {path.split('/').pop()} {/* Display only the folder name */}
        </div>
        {isExpanded && (
          <div className="nested-tree" style={{ marginLeft: 20}}>
            {Object.entries(node).map(([nodeName, nestedNode]) =>
              renderTreeNode(nestedNode, `${path}/${nodeName}`)
            )}
          </div>
        )}
      </div>
    );
  };

  // CONTROLS

  // Monaco States 
  const [linePosition, setLinePosition] = useState({});
  const [lineEditOperation, setLineEditOperation] = useState({})
  const [editorObject, setEditorObject] = useState({})
  const [monacoObject, setMonacoObject] = useState({})
  
  // AI States
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState("");
  
  // File Upload States
  const [originalFile, setOriginalFile] = useState("");
  const [exportText, setExportText] = useState("Export")

  // Display References
  const editorRef = useRef(null);
  const frameRef = useRef(null);
  const loaderRef = useRef(null); 
  const formRef = useRef(null);
  const uploadRef = useRef(null);

  // EDITOR FUNCTIONS
  function handleEditorDidMount(editor, monaco) {
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
        model: "gpt-3.5-turbo",
        // model: "gpt-4",
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

  // BUILD FUNCTION
  const handleBuild = async () => {
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
  }

  // EDITOR FUNCTIONS
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

  async function handleFrameChange(frameNumber) {
    if (editorRef.current) {
      if (frameNumber === 0) {editorRef.current.setValue(editorCurrent)} 
      else {editorRef.current.setValue(AIResults[frameNumber - 1]); }
      setCurrentFrame(frameNumber)
      monacoAutoformat()
      const moneyyy = await handleBuild(); 
    }
  }

  async function handleExport() {
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
            setExportText(`Exporting Zip... ${Math.floor((number / fileCount) * 100)}%`);
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
            } else {
              console.log("No files to export.");
              setExportText("Export");
            }
          } catch (error) {
            console.error("An error occurred while exporting the project.", error);
            setExportText("Export");
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
        
        <div  style={{zIndex: 1, width: "50vw", height: "calc(100% - 41px)", position: "absolute"}}>
          <div style={{height: "100%", width: "100%", position: "absolute", display: "flex", flexDirection: "row"}}> 
            <div style={{width: sidebar? "150px" : "50px", height: "100%", backgroundColor: "black", borderRight: "0.1px solid white", display: "flex", flexDirection: "column", alignItems: "center"}}>
              {sidebar === false && <FaBars color="white" size={21} style={{marginTop: "10px", cursor: "pointer"}} onClick={()=>{handleSidebar()}}/>}
              {sidebar && <IoChevronBack color="white" size={27} style={{marginTop: "8px", marginLeft: "-112px", cursor: "pointer"}} onClick={()=>{handleSidebar()}}/>}
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
                      currentFile = openFiles[index]
                      setFile(currentFile)}}
                    style={{opacity: openFileNum === index? 1 : 0.6, height: "100%", width: "100px", minWidth: "100px", backgroundColor: "transparent", borderRight: "0.1px solid white", display: "flex", alignItems: "center", userSelect: "none", cursor: "pointer"}}>
                    <div style={{overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", backgroundColor: "transparent", width: "calc(100% - 22px)", height: "auto"}}>
                      <p style={{color: "white", marginLeft: "10px", fontSize: "15px"}}>{item.name}</p>
                    </div>
                    <div className="file-x" style={{position: "absolute", marginLeft: "82px", width: "15px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "transparent", opacity: 0.35}}>
                      <IoClose color="white" size={19} onClick={()=>{closeFile(index)}}/>
                    </div>
                 </div>
                ))}

              </div>
              <div style={{height: "calc(100% - 25px)", paddingTop: "5px", backgroundColor: "black"}}>
                <Editor
                  onChange={()=>{let fileOpened = openFileNum; handleEditorChange(fileOpened)}}
                  height="100%"
                  defaultLanguage = {openFileNum === null ?  "javascript" : file.language}
                  value = {openFileNum === null ?  "" : file.value}
                  path = {openFileNum === null ?  "/" : file.name}
                  theme="hc-black"
                  onMount={handleEditorDidMount}
                  />
                </div>
            </div>
          </div>
        </div>

        <div ref={frameRef} style={{width: "50vw", marginLeft: "50vw", height: "calc(100% - 41px)", backgroundColor: "black", borderLeft: "0.1px solid white"}}>
        </div>

        <div style={{zIndex: 2, backgroundColor: "black", borderTop: "0.1px solid white", position: "absolute", bottom: 0, left: 0, paddingLeft: "14px", height: "40px", width: "100vw", display: "flex", flexDirection: "row", borderTop: "0.1px solid black", gap: "6px", alignItems: "center"}}>
            <div onClick={()=>{
              setAIMode(AIMode === "ADD"? "ALTER" : "ADD")
            }} style={{color: "white", cursor: "pointer", marginLeft: "42px", fontWeight: "500", opacity: 0.9}}>{AIMode}:</div>
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
            <button ref={formRef} 
              onClick={handleSubmit}
              className="prompt-button"
              style={{padding: "5px 10px", marginLeft: "10px", border: "1px solid white", color: "white", borderRadius: "4px", fontSize: "12px"}}
              >Go</button>
            <button style={{padding: "5px 10px", border: "1px solid white", color: "white", borderRadius: "4px", fontSize: "12px"}} 
              className="prompt-button"
              onClick={handleBuild}>
              Build
            </button> 
            <button style={{marginLeft: "15px", opacity: currentFrame === 1? 1 : 0.7, padding: "5px 10px", border: "1px solid white", color: "white", borderRadius: "4px", fontSize: "12px"}} 
              className="prompt-button"
              onClick={()=>{handleFrameChange(1)}}>
              1st 
            </button> 
            <button style={{opacity: currentFrame === 2? 1 : 0.7, padding: "5px 10px", border: "1px solid white", color: "white", borderRadius: "4px", fontSize: "12px"}} 
              className="prompt-button"
              onClick={()=>{handleFrameChange(2)}}>
              2nd
            </button> 
            <button style={{opacity: currentFrame === 3? 1 : 0.7, padding: "5px 10px", border: "1px solid white", color: "white", borderRadius: "4px", fontSize: "12px"}} 
              className="prompt-button"
              onClick={()=>{handleFrameChange(3)}}>
              3rd 
            </button> 
            <button style={{opacity: currentFrame === 4? 1 : 0.7, padding: "5px 10px", border: "1px solid white", color: "white", borderRadius: "4px", fontSize: "12px"}} 
              className="prompt-button"
              onClick={()=>{handleFrameChange(4)}}>
              4th
            </button> 
            <button style={{marginLeft: "15px", padding: "5px 10px", border: "1px solid white", color: "white", borderRadius: "4px", fontSize: "12px"}} 
              className="prompt-button"
              onClick={()=>{handleFrameChange(0)}}>
              Original
            </button> 
            <button style={{whiteSpace: "nowrap", marginLeft: "15px", padding: "5px 10px", border: "1px solid white", color: "white", borderRadius: "4px", fontSize: "12px"}} 
              className="prompt-button"
              onClick={()=>{handleExport()}}>
                {exportText}
            </button> 
          </div>
      </div>
  );
};

export default ReactAI;