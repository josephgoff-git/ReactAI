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
import { CgPlayListAdd } from 'react-icons/cg';
import { AiFillCloseCircle } from 'react-icons/ai';
import { HiPlusSm } from 'react-icons/hi';
import { BsChevronLeft, BsWindow } from 'react-icons/bs'
import { BsWindowSplit } from 'react-icons/bs'
import { FaBars, FaBullseye } from 'react-icons/fa';
import { FiEdit } from 'react-icons/fi'
import { BsArrowRightCircle } from "react-icons/bs"
import { BsThreeDotsVertical } from 'react-icons/bs';
import { BsArrowRightCircleFill } from 'react-icons/bs';
import { BsQuestionCircle } from 'react-icons/bs';
import { SiReact } from 'react-icons/si';
import { BsCalculator, BsChevronDown } from 'react-icons/bs'
import { IoChevronBack, IoClose } from 'react-icons/io5'
import { useComponentIndexOverStore, useProjectTitleStore, useClickedNewAppStore, useHasFilesStore, useShowEditorStore, useShowGPTStore, useFirstBuildStore, useCurrentStackStore, useHeightStore, useWidthStore, useXValStore, useYValStore } from "../activitiesStore"
import { openDatabase, storeFile, retrieveFileTree, retrieveFileByPath, retrieveFilePaths, retrieveTreeNodeByPath, resolvePath, resolvePackage, deleteFile } from "../fileUtils.js"
import semver from 'semver';
import untar from 'js-untar';
import axios from 'axios';
import Draggable from "react-draggable";

import Canvas from "../DraggableList"
import { parse } from 'html-parse-stringify2';

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


  var height = useHeightStore((state) => state.height);
  const setHeight = useHeightStore((state) => state.setHeight);

  var width = useWidthStore((state) => state.width);
  const setWidth = useWidthStore((state) => state.setWidth);

  var xVal = useXValStore((state) => state.xVal);
  const setXVal = useXValStore((state) => state.setXVal);

  var yVal = useYValStore((state) => state.yVal);
  const setYVal = useYValStore((state) => state.setYVal);



  // STATES
  var hasFiles = useHasFilesStore((state) => state.hasFiles);
  const setHasFiles = useHasFilesStore((state) => state.setHasFiles);

  var showEditor = useShowEditorStore((state) => state.showEditor);
  const setShowEditor = useShowEditorStore((state) => state.setShowEditor);

  var showGPT = useShowGPTStore((state) => state.showGPT);
  const setShowGPT = useShowGPTStore((state) => state.setShowGPT);
  
  var firstBuild = useFirstBuildStore((state) => state.firstBuild);
  const setFirstBuild = useFirstBuildStore((state) => state.setFirstBuild);

  var clickedNewApp = useClickedNewAppStore((state) => state.clickedNewApp);
  const setClickedNewApp = useClickedNewAppStore((state) => state.setClickedNewApp);

  var projectTitle = useProjectTitleStore((state) => state.projectTitle);
  const setProjectTitle = useProjectTitleStore((state) => state.setProjectTitle);
  
  var currentStack = useCurrentStackStore((state) => state.currentStack);
  const setCurrentStack = useCurrentStackStore((state) => state.setCurrentStack);


  const [refreshCount, setRefreshCount] = useState(1) 
  const [hasRunOnce, setHasRunOnce] = useState(false)
  const [AIResults, setAIResults] = useState([])
  const [currentFrame, setCurrentFrame] = useState(0)
  const [editorCurrent, setEditorCurrent] = useState("")
  const [AIMode, setAIMode] = useState("ALTER")
  const [warning, setWarning] = useState(false)
  const [warningText1, setWarningText1] = useState("Building Project...")
  const [warningText2, setWarningText2] = useState("Please wait, this may take a moment")
  const [warningText3, setWarningText3] = useState("")
  const [dotsOpen, setDotsOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [slate, setSlate] = useState(0)
  const [displayColor, setDisplayColor] = useState("black")
 

  // Editor States 
  const [linePosition, setLinePosition] = useState({});
  const [lineEditOperation, setLineEditOperation] = useState({})
  const [editorObject, setEditorObject] = useState({})
  const [monacoObject, setMonacoObject] = useState({})
  const [editorScrollbar, setEditorScrollbar] = useState("hidden")
  const [fullScreen, setFullScreen] = useState(false)
  const [fullScreenText, setFullScreenText] = useState("Full Screen")
  // "visible"
  const [error, setError] = useState("")
  const [progress, setProgress] = useState(0);
  const [storingProgress, setStoringProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [canCloseWarning, setCanCloseWarning] = useState(false)
  const [renderButtonWidths, setRenderButtonWidths] = useState("25%")
  const [canShowWarning, setCanShowWarning] = useState(true)
  const [canShowBuildMode, setCanShowBuildMode] = useState(true)
  // AI States
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState("");
  const [GPTModel, setGPTModel] = useState("3.5-turbo")
  const [numberOfRenders, setNumberOfRenders] = useState(4)
  const [modelTemperature, setModelTemperature] = useState(0.8)
  
  // File Upload States
  const [originalFile, setOriginalFile] = useState("");
  const [exportText, setExportText] = useState("Export Zip")
  const [displayWarningProgress, setDisplayWarningProgress] = useState(false)

  // Display References
  const editorRef = useRef(null);
  const frameRef = useRef(null);
  const loaderRef = useRef(null); 
  const formRef = useRef(null);
  const uploadRef = useRef(null);

  // Build Mode
  const [buildMode, setBuildMode] = useState(false)
  const [BuildAlert1Text, setBuildAlert1Text] = useState("Your Project")
  const [BuildButton1Text, setBuildButton1Text] = useState("Let's Get Started")
  const [buildModeStack, setBuildModeStack] = useState(false)
  const [buildingStack, setBuildingStack] = useState(false)
  const [updateStackNum, setUpdateStackNum] = useState(1)
  const [selectedBuildComponent, setSelectedBuildComponent] = useState("")
  const [lastEdited, setLastEdited] = useState("")

  // Components 
  const [componentData, setComponentData] = useState([])
  const [draggable, setDraggable] = useState(false)

  // Component Lists
  const [navbars, setNavbars] = useState([
    {name: "Navbar1", component: "Navbar", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQTcambbFohMFsVArOWH_mSS9SBAZrNbTPiGw&usqp=CAU" },
    {name: "Navbar1", component: "Header", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQTcambbFohMFsVArOWH_mSS9SBAZrNbTPiGw&usqp=CAU" },
    {name: "Navbar1", component: "Navbar", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQTcambbFohMFsVArOWH_mSS9SBAZrNbTPiGw&usqp=CAU" },
    {name: "Navbar1", component: "Navbar", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQTcambbFohMFsVArOWH_mSS9SBAZrNbTPiGw&usqp=CAU" },
    {name: "Navbar1", component: "Navbar", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQTcambbFohMFsVArOWH_mSS9SBAZrNbTPiGw&usqp=CAU" },
    {name: "Navbar1", component: "Navbar", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQTcambbFohMFsVArOWH_mSS9SBAZrNbTPiGw&usqp=CAU" },
    {name: "Navbar1", component: "Navbar", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQTcambbFohMFsVArOWH_mSS9SBAZrNbTPiGw&usqp=CAU" },
  ])

  // Pages
  const [buildModeStackRoute, setBuildModeStackRoute] = useState("Pages")
  const [pageNames, setPageNames] = useState(["Home"])
  const [currentPage, setCurrentPage] = useState(0)


  // Deployment
  const [deploymentText, setDeploymentText] = useState("Deploy")


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
      return <div className="tree-item" onClick={()=>{handleFileOpen(path)}} style={{color: "white", marginBottom: "3px", borderBottom: "0.3px solid #888", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", fontFamily: "sans-serif"}} key={path}>{path.split('/').pop()}</div>; 
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

  async function retrieveFilePaths2() {
    return new Promise(async (resolve, reject) => {
      const db = await openDatabase(); // Open or create the database
      const transaction = db.transaction('files', 'readonly');
      const objectStore = transaction.objectStore('files');
  
      // Get Count
      let fileCount = 37000;
      let number = 0;
      const countRequest = objectStore.count();
      countRequest.onsuccess = async event => {
        fileCount = event.target.result;
      };
  
      // Retrieve all files
      const request = objectStore.openCursor(); // Use a cursor instead of getAllKeys()
      const progressInterval = 1200; 
      let lastUpdateTime = Date.now();
  
      const processedFiles = [];
      let ranOneTime = false

      request.onsuccess = event => {
        if (!ranOneTime) {
          setWarningText1("Retrieving Project Files...")
          setDisplayWarningProgress(true)
          ranOneTime = true
        }

        const cursor = event.target.result;
        if (cursor) {
          processedFiles.push(cursor.key);
          number++;
  
          // Update progress every 'progressInterval' milliseconds
          const currentTime = Date.now();
          if (currentTime - lastUpdateTime >= progressInterval) {
            const progress = (number / fileCount) * 100;
            setStoringProgress(progress)
            // console.log(`Progress: ${progress.toFixed(2)}%`);
            lastUpdateTime = currentTime;
          }
  
          // Move to the next item
          cursor.continue();
        } else {
          // All files have been processed
          resolve(processedFiles);
        }
      };
  
      request.onerror = event => {
        reject('Error retrieving files');
      };
    });
  }

  // EDITOR FUNCTIONS 
  const decorationIdsRef = useRef([]);
  const handleCursorPositionChange = () => {
    if (editorRef.current) {
      const editor = editorRef.current;
      const selection = editor.getSelection();
      if (selection) {
        const startLineNumber = selection.startLineNumber;

        // Remove previous decorations using the decorationIdsRef.current
        editor.deltaDecorations(decorationIdsRef.current, []);

        // Add a new decoration
        const newDecoration = {
          range: new monacoObject.Range(startLineNumber, 1, startLineNumber, 1),
          options: {
            isWholeLine: true,
            className: 'line-bar-decoration',
          },
        };

        // Apply the new decoration and update decorationIdsRef.current
        const newDecorationIds = editor.deltaDecorations([], [newDecoration]);
        decorationIdsRef.current = newDecorationIds;

        // Perform any other actions you need to do for the new cursor position
        setLinePosition({ startLineNumber: startLineNumber - 1, column: 1 });
        setLineEditOperation({
          range: new monacoObject.Range(startLineNumber, 0, startLineNumber, 0),
          text: '/* Insert AI generated code */\n',
          forceMoveMarkers: true,
        });
      }
    }
  };

  useEffect(() => {
    if (editorRef.current) {
      const editor = editorRef.current;
      const disposable = editor.onDidChangeCursorSelection(handleCursorPositionChange);
      try {monacoAutoformat()} catch (error) {console.log(error)}
      return () => {
        disposable.dispose();
      };
    }
  }, [editorRef.current]);

  let blankSlate = false;

  function setPagesList(copy) {
    setPageNames(copy)
  }

  useEffect(() => { 
    // Mouse Event for deleting from the stack
    const handleMouseDown = async (event) => {
      // console.log(pageNames)
      const closeButton = event.target.closest(".component-item-close");
    };
    
    document.addEventListener('mousedown', handleMouseDown);
    
    // Clean up the event listeners when the component is unmounted
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
    
  }, []);

  async function gitComponents() {
    // Grab git components
    // Retrieve code
    const git_user = "josephgoff-git";
    const git_repo = "components";
    const branch = "master";
    // const proxyUrl = 'http://localhost:3001/github-proxy';
    const proxyUrl = 'https://reactaiserver.azurewebsites.net/github-proxy';
    const githubApiUrl = `https://api.github.com/repos/${git_user}/${git_repo}/zipball/${branch}`;
  
    let componentDataCopy = componentData

    try {
      const response = await axios.get(`${proxyUrl}?url=${encodeURIComponent(githubApiUrl)}`, {
        responseType: 'arraybuffer',
      });
  
      const zipData = new Uint8Array(response.data);
      const jszip = new JSZip();
      const unzippedFiles = await jszip.loadAsync(zipData);
   
      let process = 0
      const filesArray = [];
      for (const [relativePath, file] of Object.entries(unzippedFiles.files)) {
        // If file is actually a file
        if (file.dir || file._data.uncompressedSize === 0) {
            continue;
        } else {
          let pieces = file.name.split("/")
          let folderName = pieces[1]
          let componentName = pieces[2]

          let found = false
          for (let i=0;i<componentDataCopy.length;i++) {
            if (componentDataCopy[i][0] === folderName) {
              found = true; 
              let found2 = false
              for (let j=0;j<componentDataCopy[i][1].length;j++) {
                if (componentDataCopy[i][1][j].component === componentName) {
                  found2 = true; 
                }
              } 
              if (!found2) {
                componentDataCopy[i][1].push({component: componentName})
                console.log(componentDataCopy)
              }
            }
          } 
          if (!found) {
            componentDataCopy.push([folderName, [{component: componentName}]])
            console.log(componentDataCopy)

          }

          let blob = await file.async('blob');
          const fileName = file.name.replace(/^[^/]+\//, 'react-app/');
          const fileType = blob.type;
          const fileName1 = fileName.split('/').pop();

          let parts = fileName.split('/');
          parts[1] = "src/components";
          parts[2] = componentName
          parts[3] = componentName + "." + parts[3].split(".")[1]
          let newFileName = parts.join('/');

          const fileObject = {
              blob,
              name: fileName1,
              type: fileType,
              webkitRelativePath: newFileName,
          };
          filesArray.push(fileObject);
        }
        process += 1;

      }
      setComponentData(componentDataCopy)
    } catch(error) {console.log(error)}
  }

  async function handleEditorDidMount(editor, monaco) {
    await gitComponents();

    console.log("First Build: ", firstBuild)
    if (firstBuild) {setWarning(true)}
    
    // First Build
    const projectName = await handleBuild(); 
    
    // Once done building, open up App.js if it exists
    if (!clickedNewApp) {
      let appjs = null;
      try {appjs = await retrieveFileByPath(`${projectTitle}/src/App.js`)
      } catch {appjs = null}
      if (appjs !== null) {
        await handleFileOpen(`${projectTitle}/src/App.js`)
      }
    }

    // let decorationIds = [];
    editorRef.current = editor;

    setEditorObject(editor)
    setMonacoObject(monaco)
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
    let currentComponent = selectedBuildComponent;
    let currentFile = null
    try {currentFile = file} catch (error) {console.log(error)}

    let isComponentFile = false
    let currentCode = ""
      try {
      if (currentComponent !== "") {
        isComponentFile = true
        currentCode = await retrieveFileByPath(`${projectTitle}/src/components/${currentComponent}/${currentComponent}.js`)
      } else if (currentFile !== "") {
        currentCode = await retrieveFileByPath(file.path)
      } 
    } catch(error) {
      console.log(error)
      return 
    }

    console.log(currentCode)

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
    if (AIMode === "ADD") {
      userMessage = "Here is a jsx file from my React project. Please locate this comment in code that says exactly: {/* Insert  AI generated code */}, and then return to me a snippet of code meant to replace that coment based on these instructions: Add "
      + prompt 
      + ". Please don't return the entire file. Only return the code to replace that comment! Make sure your response only contains code and nothing else. Here is the jsx file: \n\n" 
      + currentCode
    } else if (AIMode === "ALTER") {
      // userMessage = prompt 
      // + ". Return the FULL jsx code for the file back to me. Here's the jsx file: " 
      // + editorRef.current.getValue()
      userMessage = "Here is a jsx component: Please do this: '"
      + prompt 
      + "'. Return the FULL jsx code for the file back to me. For any CSS you write, ALL the css must be inline. Remember, you must do this all in one singular file. Here's the current file: " 
      + currentCode
    } 
    
    setIsLoading(true);

    // Wait for AI return messages and replace code in editor 
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
        console.log("AI ARRAY VAL:", newContent)
        AIArray.push(newContent)
        if (i === 0) {
          let openFilesCopy = openFiles
          if (currentComponent !== "") {
            console.log("storing 1")

            // Verify that file contains style link
            if (isComponentFile) {
              const lines = newContent.split('\n');
              // const modifiedLines = lines.filter(line => !line.trim().startsWith(`import ${componentName}`));
              let needsImport = true
              for (let i=0;i<lines.length;i++) {
                if (lines[i].includes(`import "./${currentComponent}.css"`) || lines[i].includes(`import './${currentComponent}.css'`)) {
                  needsImport = false
                }
              }

              if (needsImport) {
                newContent = `import "./${currentComponent}.css"\n` + newContent
              }
              // const modifiedString = modifiedLines.join('\n');
            }


            await storeFile(`${projectTitle}/src/components/${currentComponent}/${currentComponent}.js`, newContent)
            // Refresh files by closing all 
            setOpenFiles([])
            setFile({})
            setOpenFileNum(null)
            setLastEdited(`${projectTitle}/src/components/${currentComponent}/${currentComponent}.js`)
            
            let newOpenFiles = []
            async function openAfterSubmit(path) {
              let fileData = await retrieveFileByPath(path)
            
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

              newOpenFiles.push({
                name: fileName,
                language: type,
                value: fileData,
                path: path })
              setRefreshCount(refreshCount + 1)
              setFile({
                name: fileName,
                language: type,
                value: fileData,
                path: path
              })
              setOpenFileNum(0)
            } 
  
            for (let k=0;k<openFilesCopy.length;k++) {
              try {
                await openAfterSubmit(openFilesCopy[k].path)
              } catch(error) {console.log(error)}
            }
            setOpenFiles(newOpenFiles)
            setCurrentFrame(1)
            
      
          
          } else {
            if (currentFile !== null) {
              await storeFile(currentFile.path, newContent)
              // Refresh files by closing all 
              setOpenFiles([])
              setFile({})
              setOpenFileNum(null)
              setLastEdited(currentFile.path)
              
              let newOpenFiles = []
              async function openAfterSubmit(path) {
                let fileData = await retrieveFileByPath(path)
              
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
  
                newOpenFiles.push({
                  name: fileName,
                  language: type,
                  value: fileData,
                  path: path })
                setRefreshCount(refreshCount + 1)
                setFile({
                  name: fileName,
                  language: type,
                  value: fileData,
                  path: path
                })
                setOpenFileNum(0)
              } 
    
              for (let k=0;k<openFilesCopy.length;k++) {
                try {
                  await openAfterSubmit(openFilesCopy[k].path)
                } catch(error) {console.log(error)}
              }
              setOpenFiles(newOpenFiles)
              setCurrentFrame(1)
              
            }
          }
          
        }
      }
      setAIResults(AIArray)
    } catch (error) {
      console.error('Error fetching data:', error);
      setIsSubmitting(false)
    }

    // Back Space
    // editorRef.current.setValue(newContent);
    // let editOperations = [{
    //   range: editorRef.current.getModel().getFullModelRange(),
    //   text: botMessage,
    // }];

    // editorRef.current.executeEdits("my-source", editOperations);
    // editorRef.current.pushUndoStop();
    // editorRef.current.setValue(botMessage)

    // let editOperations = [{
    //   range: editor.getModel().getFullModelRange(),
    //   text: botMessage,
    // }];

    // editor.executeEdits("my-source", editOperations);
    // editor.pushUndoStop();

    // Auto reformat the new code
    monacoAutoformat()
    const moneyyy = await handleBuild(); 
    setHasRunOnce(true)
  };
  
  async function getMessage(messages) {
    // const proxyUrl = 'http://localhost:3001/gpt-message-editor';
    const proxyUrl = 'https://reactaiserver.azurewebsites.net/gpt-message-editor';
    try {
      const response = await axios.post(proxyUrl, { message: messages, gpt: GPTModel, temperature: modelTemperature});
      return response.data
    } catch (error) {
      return 'Something went wrong...'
    }
  }

  function findAndReplace(code, replacement) {
    const regex = /\/\*\s*Insert\s*AI\s*generated\s*code\s*\*\/\s*/;
    const updatedCode = code.replace(regex, replacement + "\n");
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
      console.log("Error getting message");
      return null
    }
  };

  // BUILD FUNCTION
  const handleBuild = async (appJSCode) => {
    try {
      // restore the stack
      try {
        let appJS = ""
        if (typeof appJSCode === "string") {
          appJS = appJSCode
          console.log(appJS)
        }
        else {
          appJS = await retrieveFileByPath(`${projectTitle}/src/App.js`);
        }
      } catch (error) {
        console.log(error)
      }

      console.log("getting file paths")
      let filePaths = await retrieveFilePaths()
      if (firstBuild) {
        setWarning(true)
        filePaths = await retrieveFilePaths2()
      } else {filePaths = await retrieveFilePaths();}
      console.log("got file paths")
      console.log(filePaths)
      let fileTree = await retrieveFileTree();
      console.log("got file tree")
      console.log(fileTree)
      let projectName = filePaths[0].split("/")[0];

      if (firstBuild || blankSlate) {
        let packageJson = await retrieveFileByPath(`${projectTitle}/package.json`);
        let packageDependencies = JSON.parse(packageJson).dependencies;
        let packageQueue = Object.entries(packageDependencies)
        let packageData = {}

        let step = 0;
        while (packageQueue.length) {
          let [packageName, packageVersion] = packageQueue.pop();
          if (packageName in (fileTree[projectName]['node_modules'] || {})) {
            console.log(`${packageName} is already installed, skipping...`)
            continue
          }
          if (packageName in packageData) { continue }
          if (packageName === 'react-scripts') { continue }
        
          step += 1
          if (step % 2 === 0 && blankSlate) {setStoringProgress((step/12) * 100)}
          console.log(`Fetching package data for ${packageName}...`);
          let response = await fetch(`https://registry.npmjs.org/${packageName}`);
          let data = await response.json();
          let versions = Object.keys(data.versions);
          let version = semver.maxSatisfying(versions, packageVersion);
        
          packageData[packageName] = data.versions[version];
          let dependencies = data.versions[version].dependencies;
          for (let dependency in dependencies) {
        packageQueue.push([dependency, dependencies[dependency]])
          }
        }
        
        for (let packageName in packageData) {
          step += 1
          setStoringProgress((step/12) * 100)
          console.log(`Installing ${packageName}`)
          let tarballURL = packageData[packageName].dist.tarball;
          let packageFiles = await fetch(tarballURL)
        .then(stream => stream.body.pipeThrough(new window.DecompressionStream("gzip")))
        .then(stream => new Response(stream).arrayBuffer())
        .then(stream => untar(stream));
        
          for (let file of packageFiles) {
        let path = file.name.replace(/^package\//, `${projectName}/node_modules/${packageName}/`);
        if (!path.startsWith(`${projectName}`)) {path = `${projectName}/node_modules/` + path}
        await storeFile(path, file.blob);
          }
        }
      }


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
      iframe.setAttribute('frameborder', '0'); // Change from '100%' to '0' for frameborder
      frameRef.current.innerHTML = '';
      frameRef.current.appendChild(iframe);
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(indexHTML);
      iframe.contentWindow.document.close();

      // Access the iframe content and attach click event listener
      // const iframeContent = iframe.contentWindow.document
      // iframeContent.body.addEventListener('click', (event) => {
      //   console.log("clicked screen")
      //   console.log(event.screenY)
      //   const componentName = event.target.getAttribute('data-component-name');
      //   if (componentName) {
      //     console.log(event)
      //   }
      // }, true);

      clearUserPrompt();
      setPrompt("")
      setLineEditOperation({})
      setIsSubmitting(false)
      setCanCloseWarning(true)
      setDisplayWarningProgress(false)
      setFirstBuild(false);

      setStoringProgress(0)
      setProgress(0)

      // New App? -> Build Mode 
      if (clickedNewApp) {
        setBuildMode(true);     
        setBuildingStack(true)
      }
      setClickedNewApp(false)
      let extension = pageNames[currentPage].toLowerCase()
      if (pageNames[currentPage] === "Home") {extension = ""}
      changePage(extension)

      return projectName
    } catch (error) {
      if (firstBuild || blankSlate) {
        handleRebuild()
      } else {
      console.log(error)
      giveWarning("Error", "View console for error message from your code: Right Click > Inspect > Console", "User Close")
      // let location = await askGPT("Here's an error from my React app. Return back to me one of two things. Return 'App.js' if you're unsure what file is causing the error. If you think you know the name of the file causing the error, then return the name of that file back to me, and NOTHING else. Here is the error message: " + error)
      // setWarningText3("AI suggests: " + location)
      setIsSubmitting(false)
      setCanCloseWarning(true)
      setDisplayWarningProgress(false)
      setFirstBuild(false);
      }
    }
  }

  const handleRebuild = async () => {
    try {
      console.log("getting file paths")
      let filePaths = await retrieveFilePaths()
      if (firstBuild) {
        setWarning(true)
        filePaths = await retrieveFilePaths2()
      } else {filePaths = await retrieveFilePaths();}
      console.log("got file paths")
      console.log(filePaths)
      let fileTree = await retrieveFileTree();
      console.log("got file tree")
      console.log(fileTree)
      let projectName = filePaths[0].split("/")[0];
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

      // const iframe = document.createElement('iframe');
      // iframe.setAttribute('width', '100%');
      // iframe.setAttribute('height', '100%');
      // iframe.setAttribute('frameborder', '0');
      // frameRef.current.innerHTML = '';
      // frameRef.current.appendChild(iframe);
      // iframe.contentWindow.document.open();
      // iframe.contentWindow.document.write(indexHTML);
      // iframe.contentWindow.document.close();

      const iframe = document.createElement('iframe');
      iframe.setAttribute('width', '100%');
      iframe.setAttribute('height', '100%');
      iframe.setAttribute('frameborder', '0'); // Change from '100%' to '0' for frameborder
      frameRef.current.innerHTML = '';
      frameRef.current.appendChild(iframe);
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(indexHTML);
      iframe.contentWindow.document.close();

      // Access the iframe content and attach click event listener
      // const iframeContent = iframe.contentWindow.document
      // iframeContent.body.addEventListener('click', (event) => {
      //   console.log("clicked screen")
      //   const componentName = event.target.getAttribute('data-component-name');
      //   if (componentName) {console.log(componentName)}
      // }, true);

      clearUserPrompt();
      setPrompt("")
      setLineEditOperation({})
      setIsSubmitting(false)
      setCanCloseWarning(true)
      setDisplayWarningProgress(false)
      setFirstBuild(false);

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
        // Open up App.js if it exists
        let appjs = null;
        try {appjs = await retrieveFileByPath(`${projectTitle}/src/App.js`)
        } catch {appjs = null}
        if (appjs !== null) {
          await handleFileOpen(`${projectTitle}/src/App.js`)
        }
      }

      // New App? -> Build Mode 
      if (clickedNewApp) {
        setBuildMode(true)
        setBuildingStack(true)
      }
      setClickedNewApp(false)

    } catch (error) {
      console.log(error)
      giveWarning("Error", "View console for error message from your code: Right Click > Inspect > Console", "User Close")
      let location = await askGPT("Here's an error from my React app. Return back to me one of two things. Return 'App.js' if you're unsure what file is causing the error. If you think you know the name of the file causing the error, then return the name of that file back to me, and NOTHING else. Here is the error message: " + error)
      setWarningText3("AI suggests: " + location)
      setIsSubmitting(false)
      setCanCloseWarning(true)
      setDisplayWarningProgress(false)
      setFirstBuild(false);
      
    }
  }

  // MONACO EDITOR FUNCTIONS
  const [openFiles, setOpenFiles] = useState([])

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

  let currentFile = null;
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
    let openFilesCopy = openFiles
    let fileData = await retrieveFileByPath(path)
    let found = false
    for (let i=0;i<openFilesCopy.length;i++) {
      if (openFilesCopy[i].path === path) {
        // File is already open
        found = true
        setOpenFiles(openFilesCopy)
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

      // setOpenFiles( prev => [{
      //   name: fileName,
      //   language: type,
      //   value: fileData,
      //   path: path
      // }, ...prev])
      setOpenFiles( prev =>[{
        name: fileName,
        language: type,
        value: fileData,
        path: path }, ...prev])
      setRefreshCount(refreshCount + 1)
      setFile({
        name: fileName,
        language: type,
        value: fileData,
        path: path
      })
      setOpenFileNum(0)
    } 
    return fileData
  }

  function clearUserPrompt() {
    const inputElement = document.getElementById("userPrompt");
    if (inputElement) {
      inputElement.value = "";
    }
  }

  // DISPLAY
  async function handleFrameChange(frameNumber) {
    console.log(AIResults)
    console.log(lastEdited)
    if (lastEdited !== "") {
      try {
        if (frameNumber === 0) {
          await storeFile(lastEdited, editorCurrent)
        } 
        else {
          await storeFile(lastEdited, AIResults[frameNumber - 1])
        }
        let openFilesCopy = openFiles
        setOpenFiles([])
        setFile({})
        setOpenFileNum(null)
  
        let newOpenFiles = []
        async function openAfterSubmit(path) {
          let fileData = await retrieveFileByPath(path)
        
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

          newOpenFiles.push({
            name: fileName,
            language: type,
            value: fileData,
            path: path })
          setRefreshCount(refreshCount + 1)
          setFile({
            name: fileName,
            language: type,
            value: fileData,
            path: path
          })
          setOpenFileNum(0)
        } 

        for (let k=0;k<openFilesCopy.length;k++) {
          try {
            await openAfterSubmit(openFilesCopy[k].path)
          } catch(error) {console.log(error)}
        }
        setOpenFiles(newOpenFiles)
        
        setCurrentFrame(frameNumber)
        monacoAutoformat()
        const moneyyy = await handleBuild(); 
      } catch (error) {console.log(error)}
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

  // CLOSE ALERTS 
  let outsideClicks = 0;
  function handleOutsideClick() {
    if (canCloseWarning) { 
      if (outsideClicks !== 0) {
        setWarningText3("")
        setWarning(false)
        setDotsOpen(false)
        outsideClicks = 0;
      } else {outsideClicks += 1}
    }
  };

  let outsideClicks2 = 0;
  function handleOutsideClick2() {
    if (outsideClicks2 !== 0) {
      setDotsOpen(false)
      outsideClicks2 = 0;
    } else {outsideClicks2 += 1}
  };

  let optionsOutsideClicks = 0;
  function handleOptionsOutsideClick() {
    if (optionsOutsideClicks !== 0) {
      console.log(1)
      setOptionsOpen(false)
      optionsOutsideClicks = 0;
    } else {optionsOutsideClicks += 1}
  };

  // SETTINGS 
  function switchModel() {
    if (GPTModel === "4") {
      setGPTModel("3.5-turbo")
    } else {setGPTModel("4")}
  }

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
              setExportText("Export Zip");
              setIsUploading(false)
              setProgress(0)
            } else {
              console.log("No files to export.");
              setExportText("Export Zip");
              setIsUploading(false)
              setProgress(0)
            }
          } catch (error) {
            console.error("An error occurred while exporting the project.", error);
            setExportText("Export Zip");
            setIsUploading(false)
            setProgress(0)
          }
        }
      };
  
      request.onerror = event => {
        console.error("An error occurred while exporting the project.", event.target.error);
        setExportText("Export Zip");
      };
    };
  
    countRequest.onerror = event => {
      console.error("An error occurred while counting the files.", event.target.error);
      setExportText("Export Zip");
    };
  }

  // OPTIONS 
  const handleBlankSlate = async () => {
    setRefreshCount(1) 
    setHasRunOnce(false)
    setAIResults([])
    setCurrentFrame(0)
    setEditorCurrent("")
    setAIMode("ALTER")
    // setWarning(false)
    // setWarningText1("Building Project...")
    // setWarningText2("Please wait, this may take a moment")
    // setWarningText3("")
    setDotsOpen(false)
    setOptionsOpen(false)
    setSlate(0)
  
    // Editor States 
    setLinePosition({});
    setLineEditOperation({})
    // setEditorObject({})
    // setMonacoObject({})
    setEditorScrollbar("hidden")
    setFullScreen(false)
    setFullScreenText("Full Screen")
    // "visible"
    setError("")
    // setProgress(0);
    // setStoringProgress(0);
    // setIsUploading(false)
    setIsSubmitting(false)
    setCanCloseWarning(false)
    setRenderButtonWidths("25%")
    setCanShowWarning(true)
  
    // AI States
    setPrompt("");
    setMessages([]);
    setIsLoading(false);
    setLoading("");
    setGPTModel("3.5-turbo")
    setNumberOfRenders(4)
    setModelTemperature(0.8)
    
    // File Upload States
    setOriginalFile("");
    setExportText("Export Zip")
    // setDisplayWarningProgress(false)
  
    // Build Mode
    setBuildMode(false)
    setBuildAlert1Text("Your Project")
    setBuildButton1Text("Let's Get Started")
    setBuildModeStack(false)
    setBuildingStack(false)
    setUpdateStackNum(1)
    setSelectedBuildComponent("")
    setLastEdited("")

    setHasFiles(true)
    setShowEditor(true)
    setShowGPT(false)
    setFirstBuild(true)
    setClickedNewApp(true)
    setProjectTitle("react-app")
    setCurrentStack([[]])
  

    setTree({ "React Project": {}  })
    setExpandedNodes({});
    setOpenFiles([])
    setFile(null)
    setSidebar(false);
    setOpenFileNum(null);
    setDisplayColor("white")

    const git_user = "josephgoff-git";
    const git_repo = "ReactApp-Blank";
    const branch = "master";
    // const proxyUrl = 'http://localhost:3001/github-proxy';
    const proxyUrl = 'https://reactaiserver.azurewebsites.net/github-proxy';
    const githubApiUrl = `https://api.github.com/repos/${git_user}/${git_repo}/zipball/${branch}`;
  
    try {
      const response = await axios.get(`${proxyUrl}?url=${encodeURIComponent(githubApiUrl)}`, {
        responseType: 'arraybuffer',
      });
  
      const zipData = new Uint8Array(response.data);
      const jszip = new JSZip();
      const unzippedFiles = await jszip.loadAsync(zipData);
     
      let process = 0
      const filesArray = [];
      for (const [relativePath, file] of Object.entries(unzippedFiles.files)) {
        // If file is actually a file
        if (file.dir || file._data.uncompressedSize === 0) {
            continue;
        // And if file is not from node modules
        } else if (file.name.includes("/node_modules/")) {
            continue
        // Then proceed to store
        } else {
            const blob = await file.async('blob');
            const fileName = file.name.replace(/^[^/]+\//, 'react-app/');
            const fileType = blob.type;
            const fileName1 = fileName.split('/').pop();
    
            const fileObject = {
                blob,
                name: fileName1,
                type: fileType,
                webkitRelativePath: fileName,
            };
            filesArray.push(fileObject);
        }
        process += 1;
      }

      await handleGitUpload(filesArray);
      await handleBuild()

      // let appjs = null;
      // try {appjs = await retrieveFileByPath(`${projectTitle}/src/App.js`)
      // } catch {appjs = null}
      // if (appjs !== null) {
      //   await handleFileOpen(`${projectTitle}/src/App.js`)
      // }

    } catch (error) {
      console.error('Error downloading or processing the zip file:', error);
    }
  };

  async function handleGitUpload(files) {
    indexedDB.deleteDatabase("ReactProjectsDatabase");
    console.log("Deleted database");

    const db = await openDatabase(); 
    console.log("Opened new database");
    const transaction = db.transaction('files', 'readwrite');
    console.log("Began transaction");
    const objectStore = transaction.objectStore('files');
    console.log("Initiated Object Store");
    // await objectStore.clear();
    console.log("Cleared database");

    if (!files.length) {
        alert('Please select a folder to upload.');
        return;
    }

    await storeGitFiles(files);
    setFirstBuild(true)
    setHasFiles(true)
    setShowEditor(true)
};

  async function storeGitFiles(files) {
    console.log(files)
    let filesList = Array.from(files)
    for (let i = 0; i < filesList.length; i += 1000) {
        let filesChunk = filesList.slice(i, i + 1000);
        await Promise.all(filesChunk.map(file => storeGitFile(file)));
        // setProgress((i / filesList.length) * 100)
    }
  }

  async function storeGitFile(file) {
    return new Promise(async (resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = async event => {
            try {
                const fileContent = event.target.result;
                const blob = new Blob([fileContent], { type: file.type });

                const fileData = {
                    filename: file.name,
                    filepath: file.webkitRelativePath,
                    content: blob,
                };

                const db = await openDatabase();
                const transaction = db.transaction('files', 'readwrite');
                const objectStore = transaction.objectStore('files');
                await objectStore.put(fileData);
                resolve();
            } catch (e) {
                reject(e);
            }
        };

        fileReader.readAsArrayBuffer(file.blob);
    });
  }

  // BUILD MODE
  let canSelect = true;
  const emptyAppJS = `import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
  import Home from './pages/Home/Home.js'

  function App() {
    return (
      <>
        <Router>
          <Routes >
            <Route path='/' element={<Home/>} />
          </Routes>
        </Router>
      </>
    );
  }
  
  export default App;
  `
  
  // Rearrangable Components
 const [canDrag, setCanDrag] = useState(true)
  
  function DraggableList() {
    
    const initialPositions = []
    if (currentStack[currentPage]) {
      for (let i=0;i<currentStack[currentPage].length;i++) {
        initialPositions.push({ x: 0, y: 0 })
      }
    }
    
   let positions = initialPositions
    const [currentItem, setCurrentItem] = useState(null)


    function reorganizeArray(arr, currentIndex, value) {
      const newArr = [...arr];
    
      // Calculate the new index after moving by the specified value
      const newIndex = currentIndex + value;
    
      // Ensure the newIndex is within the bounds of the array
      const adjustedIndex = Math.max(0, Math.min(newIndex, arr.length - 1));
    
      // Remove the element at the current index and insert it at the adjusted index
      const removedElement = newArr.splice(currentIndex, 1)[0];
      newArr.splice(adjustedIndex, 0, removedElement);
      return newArr;
    }

    const handleDrag = (e, ui, index) => {
      // Update the positions array with the new position of the dragged item
      const newPositions = [...positions];
      newPositions[index] = { x: ui.x, y: ui.y };
      positions = newPositions  
      setCurrentItem(index)
    };

    return (
      <>
        {positions.map((position, index) => (
        
        <Draggable
            key={index}
            bounds="parent"
            className="select-none" 
            onDrag={(e, ui) => {
              if (canDrag) {
                handleDrag(e, ui, index)
              }
            }}
            defaultPosition={initialPositions[index]}
            onStop={
              async (e)=>{
                setCanDrag(false)
                let originalStack = currentStack
                let rearrangement = originalStack
                let rearrange = false
                async function stopDrag() {
                  let indicator = positions[index].y / 40
                  let numberToJump = 0;

                  if (indicator > 0.5 || indicator < -0.5) {
                    if (indicator > 0.5) {
                      numberToJump = Math.floor(indicator + 0.5)
                      rearrange = true
                    } 
                    else if (indicator < 0.5) {
                      numberToJump = Math.ceil(indicator - 0.5)
                      rearrange = true
                    }

                    rearrangement = reorganizeArray(originalStack[currentPage], index, numberToJump);
                  }

                  if (rearrange) {

                    let appjs = null;
                    try {
                      appjs = await retrieveFileByPath(`${projectTitle}/src/pages/${pageNames[currentPage]}/${pageNames[currentPage]}.js`)
                    } catch {appjs = null}
                    try {
                      if (appjs !== null) {
                        let currentCode = appjs
                        let pieces = rearrangeComponents(currentCode, rearrangement, originalStack[currentPage])
                        console.log(pieces)
                        
                        let originalStack2 = currentStack
                        originalStack2[currentPage] = rearrangement
                        setCurrentStack(originalStack2)

                        if (pieces && pieces.length >= 3) {
                          let componentPieces = reorganizeArray(pieces[1], index, numberToJump)
                          for (let k=0;k<componentPieces.length;k++) {
                            componentPieces[k] = componentPieces[k].trim()
                          }
                          currentCode = [pieces[0], componentPieces.join("\n"), pieces[2]].join("")
                          console.log(currentCode)
                          if (editorRef.current && appjs !== null) {
                            try {
                              await storeFile(`${projectTitle}/src/pages/${pageNames[currentPage]}/${pageNames[currentPage]}.js`, currentCode)
                              // Refresh files by closing all 
                              setOpenFiles([])
                              setFile({})
                              setOpenFileNum(null)
                              
                            } catch (error) {console.log(error)}
                            await handleBuild()
                            monacoAutoformat()
                          }
                        }
                    
                        // This will refresh the stack state
                        if (selectedBuildComponent !== currentStack[currentPage][index]) {
                          setSelectedBuildComponent(currentStack[currentPage][index])
                          // setBuildingStack(false)
                        } else {
                          setSelectedBuildComponent("")
                          // setBuildingStack(true)
                        }
                      }
                    } catch (error) {
                      console.log(error)
                    }

                  } else {
                    // Not a rearrange 
                    const target = e.target;
                    if (
                      target.classList.contains("component-item-close") ||
                      target.closest(".component-item-close")
                    ) {
                      // Deletion
                      await deleteComponent(index)
                    } else {
                      // Clicked on page
                      if (selectedBuildComponent === currentStack[currentPage][index]) {
                        setSelectedBuildComponent("")
                      } else {
                        setSelectedBuildComponent(currentStack[currentPage][index])
                        setBuildingStack(true)
                      }
                    }
                  }

                }
                const yessir = await stopDrag()

                console.log("opening component")
                // Open up component file again if it exists
                try {
                  let componentFile = null;
                  try {componentFile = await retrieveFileByPath(`${projectTitle}/src/components/${currentStack[currentPage][index]}/${currentStack[currentPage][index]}.js`)
                  } catch {componentFile = null}
                  if (componentFile !== null) {
                    await handleFileOpen(`${projectTitle}/src/components/${currentStack[currentPage][index]}/${currentStack[currentPage][index]}.js`)
                  }
                } catch (error) {
                  console.log(error)
                }
                setCanDrag(true)
              }
            }>
            <div className="component-item select-none" style={{userSelect: "none"}}>
              <div 
                className="hover-dim2 select-none" 
                style={{userSelect: "none", zIndex: 998,marginTop: "5px", cursor: "pointer", width: "110px", marginLeft: "10px", height: "33px", backgroundColor: selectedBuildComponent === currentStack[currentPage][index] ? "#999" :  "white", border:"1px solid black", borderRadius: "7px", display: "flex", justifyContent: "center", alignItems: "center"}}>
                <p className="select-none" style={{userSelect: "none", color: "black", fontWeight: "bold", fontFamily: "sans-serif"}}>
                  {currentStack[currentPage][index]}
                </p>
              </div>

            <div 
              className="component-item-close"
              data-index={index}
              id="deleteComponent" 
              style={{marginRight: "-6px", marginTop: "-5px", zIndex: 999, opacity: 0, filter: "brightness(90%)", cursor: "pointer", backgroundColor: "white", borderRadius: "50%", position: "absolute", top: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center"}}>
              
                <AiFillCloseCircle 
                  className="component-item-close"
                  data-index={index}
                  color="black" 
                  fontSize={20} 
                />
              </div>
        
            </div>
          </Draggable> 
        ))}
      </>
    );
  }

  function PagesDraggableList() {
    
    const initialPositions = []
    for (let i=0;i<pageNames.length;i++) {
      initialPositions.push({ x: 0, y: 0 })
    }
    
    let positions = initialPositions
    const [currentItem, setCurrentItem] = useState(null)

    function reorganizeArray(arr, currentIndex, value) {
      const newArr = [...arr];
    
      // Calculate the new index after moving by the specified value
      const newIndex = currentIndex + value;
    
      // Ensure the newIndex is within the bounds of the array
      const adjustedIndex = Math.max(0, Math.min(newIndex, arr.length - 1));
    
      // Remove the element at the current index and insert it at the adjusted index
      const removedElement = newArr.splice(currentIndex, 1)[0];
      newArr.splice(adjustedIndex, 0, removedElement);
    
      return newArr;
    }

    const handleDrag = (e, ui, index) => {
      // Update the positions array with the new position of the dragged item
      const newPositions = [...positions];
      newPositions[index] = { x: ui.x, y: ui.y };
      positions = newPositions  
      setCurrentItem(index)
    };

    return (
      <>
        {positions.map((position, index) => (
        
        <Draggable
            key={index}
            bounds="parent"
            className="select-none" 
            onDrag={(e, ui) => {
              if (canDrag) {
                handleDrag(e, ui, index)
              }
            }}
            defaultPosition={initialPositions[index]}
        
            onStop={
              async (e)=>{
                setCanDrag(false)
                let currentStackCopy = pageNames
                let rearrange = false
                let numberToJump = 0;
                async function stopDrag() {
                  let indicator = positions[index].y / 40
                  if (indicator > 0.5 || indicator < -0.5) {
                    if (indicator > 0.5) {
                      numberToJump = Math.floor(indicator + 0.5)
                      rearrange = true
                    } 
                    else if (indicator < 0.5) {
                      numberToJump = Math.ceil(indicator - 0.5)
                      rearrange = true
                    }
                  }
                }
                await stopDrag()

                if (rearrange) {
                  currentStackCopy = reorganizeArray(currentStackCopy, index, numberToJump);
                  setPageNames(currentStackCopy)
                  let currentStackReorder = reorganizeArray(currentStack, index, numberToJump);
                  setCurrentStack(currentStackReorder)
                } else {
                  // Not a rearrange 
                  const target = e.target;
                  if (
                    target.classList.contains("component-item-close") ||
                    target.closest(".component-item-close")
                  ) {
                    // Deletion
                    await deletePage(index)
                  } else {
                    // Clicked on page
                    try {
                      let componentFile = null;
                      try {componentFile = await retrieveFileByPath(`${projectTitle}/src/pages/${pageNames[index]}/${pageNames[index]}.js`)
                      } catch {componentFile = null}
                      if (componentFile !== null) {
                        await handleFileOpen(`${projectTitle}/src/pages/${pageNames[index]}/${pageNames[index]}.js`)
                        if (!rearrange) {
                          setBuildModeStackRoute("Page")
                          setCurrentPage(index)
                        }
                      }
                    } catch (error) {console.log(error)}
                    
                    let extension = pageNames[index].toLowerCase()
                    console.log(extension)
                    if (pageNames[index] === "Home") {extension = ""}
                    redirect(extension)
                  }
                }
                setCanDrag(true)
              }
            }>
            <div className="component-item select-none" style={{userSelect: "none"}}>
              <div 
                className="hover-dim2 select-none" 
                style={{userSelect: "none", zIndex: 998,marginTop: "5px", cursor: "pointer", width: "110px", marginLeft: "10px", height: "33px", backgroundColor: "white", border:"1px solid black", borderRadius: "7px", display: "flex", justifyContent: "center", alignItems: "center"}}>
                <p className="select-none" style={{userSelect: "none", color: "black", fontWeight: "bold", fontFamily: "sans-serif"}}>
                  {pageNames[index]}
                </p>
              </div>

            <div 
              className="component-item-close"
              data-index={index}
              id="deleteComponent" 
              style={{marginRight: "-6px", marginTop: "-5px", zIndex: 999, opacity: 0, filter: "brightness(90%)", cursor: "pointer", backgroundColor: "white", borderRadius: "50%", position: "absolute", top: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center"}}>
                {pageNames[index] !== "Home" && 
                <AiFillCloseCircle 
                  className="component-item-close"
                  data-index={index}
                  color="black" 
                  fontSize={20} 
                />}
              </div>

            </div>
          </Draggable> 
        ))}
      </>
    );
  }

  
  // Components
  function insertComponent(sourceCode, componentName) {

    const regex = /<\s*\/\s*(\w*)\s*>/g;
    let codeToParse = sourceCode;
    let lastClosingTag;
    let done = false;

    while (!done) {
      const match = regex.exec(codeToParse);

      if (match) {
        // Update the last closing tag
        lastClosingTag = match[0];
      } else {
        // No more closing tags found, exit the loop
        done = true;
      }
    }

    let returnCode = sourceCode;
    if (lastClosingTag) {
      // Split the codeToParse just before the last closing tag
      const splitIndex = codeToParse.lastIndexOf(lastClosingTag);
      const firstPart = codeToParse.slice(0, splitIndex);
      const secondPart = codeToParse.slice(splitIndex);

      // Now you have two parts: firstPart and secondPart
      console.log("First part:", firstPart);
      console.log("Second part:", secondPart);

      returnCode = firstPart + `<${componentName}/>\n` + secondPart
    } else {
      console.log("No closing tags found in the code.");
    }

    return returnCode
  }

  async function addComponent(component) {
    // Check if component is already in the stack and rename if needed
    let allComponents = []
    for (let i=0;i<currentStack.length;i++) {
      for (let j=0;j<currentStack[i].length;j++) {
        allComponents.push(currentStack[i][j])
      }
    }

    // Rename component to add
    let componentName = component
    let originalComponentName = component
    let newComponentName = component
    if (allComponents.includes(componentName)) {
      let i = 2
      let done = false
      let newName = componentName
      while (!done) {
        newName = componentName + "_" + i
        if (allComponents.includes(newName)) {i += 1} 
        else {done = true}
      }
      componentName = newName
      newComponentName = newName
    }

    // Retrieve component code from github 
    const git_user = "josephgoff-git";
    const git_repo = "components";
    const branch = "master";
    // const proxyUrl = 'http://localhost:3001/github-proxy';
    const proxyUrl = 'https://reactaiserver.azurewebsites.net/github-proxy';
    const githubApiUrl = `https://api.github.com/repos/${git_user}/${git_repo}/zipball/${branch}`;
  
    try {
      const response = await axios.get(`${proxyUrl}?url=${encodeURIComponent(githubApiUrl)}`, {
        responseType: 'arraybuffer',
      });
  
      const zipData = new Uint8Array(response.data);
      const jszip = new JSZip();
      const unzippedFiles = await jszip.loadAsync(zipData);
     
      let process = 0;
      const filesArray = [];
      for (const [relativePath, file] of Object.entries(unzippedFiles.files)) {
        // If file is actually a file
        if (file.dir || file._data.uncompressedSize === 0) {
            continue;
        // And if file is not from node modules
        } else if (file.name.includes("/node_modules/")) {
            continue

        } else if (!file.name.includes(`/${originalComponentName}/`)) {

          continue
        } else {
            let blob = await file.async('blob');
            const fileName = file.name.replace(/^[^/]+\//, 'react-app/');
            const fileType = blob.type;
            const fileName1 = fileName.split('/').pop();

            let parts = fileName.split('/');
            parts[1] = "src/components";
            parts[2] = componentName
            parts[3] = componentName + "." + parts[3].split(".")[1]
            let newFileName = parts.join('/');

            const fileObject = {
                blob,
                name: fileName1,
                type: fileType,
                webkitRelativePath: newFileName,
            };
            filesArray.push(fileObject);
        }
        process += 1;
      }

      await handleComponentUpload(filesArray);

      let found = false
      for (let i=0;i<openFiles.length;i++) {
        if (openFiles[i].path === path) {
          // File is already open
          found = true
          setOpenFileNum(i)
          setFile( openFiles[i] )
        }
      }
      let appjs = null;
      if (!found) {
        // Open up file if it exists
        try {appjs = await retrieveFileByPath(`${projectTitle}/src/pages/${pageNames[currentPage]}/${pageNames[currentPage]}.js`)
        } catch {appjs = null}
        if (appjs !== null) {
          await handleFileOpen(`${projectTitle}/src/pages/${pageNames[currentPage]}/${pageNames[currentPage]}.js`)
        }
      }

      let currentCode = appjs

      let importedValues = []
      let imports = currentCode.split("import ")
      if (imports.length > 0) {
        for (let j=0;j<imports.length;j++) {
          let constituents = imports[j].split(" ")
          if (constituents.length > 0) {
            importedValues.push(constituents[0])
          }
        }
      }

      let newValue = currentCode
      
      // If component is not already imported 
      if (!importedValues.includes(componentName)) {
        newValue = `import ${componentName} from '../../components/${componentName}/${componentName}.js'` + "\n" + currentCode
      }
      
      // Add the tag to App.js
      newValue = insertComponent(newValue, componentName)
      try {
        await storeFile(`${projectTitle}/src/pages/${pageNames[currentPage]}/${pageNames[currentPage]}.js`, newValue)
        setFile(null)
        setOpenFileNum(null)
        setOpenFiles([])

        console.log(newValue)
        let componentCode = null
        try {componentCode = await retrieveFileByPath(`${projectTitle}/src/components/${componentName}/${componentName}.js`)
        } catch {componentCode = null}
        
        if (componentCode) {
          let regex = new RegExp(originalComponentName, 'g');
          componentCode = componentCode.replace(regex, componentName);  

          console.log(componentCode)

          try {
            storeFile(`${projectTitle}/src/components/${componentName}/${componentName}.js`, componentCode)
            setFile(null)
            setOpenFileNum(null)
            setOpenFiles([])
          } catch (error){console.log(error)}
          await handleBuild(newValue)
        }
      
      } catch (error){console.log(error)}
      monacoAutoformat()

      // Update the stack
      let currentStackCopy = currentStack
      currentStackCopy[currentPage].push(newComponentName)
      setCurrentStack(currentStackCopy)
      
      // Rebuild
      // await handleBuild()

    } catch (error) {
      console.error('Error downloading or processing the zip file:', error);
    }
  };

  async function handleComponentUpload(files) {
    const db = await openDatabase(); 
    console.log("Opened new database");
    const transaction = db.transaction('files', 'readwrite');
    console.log("Began transaction");
    const objectStore = transaction.objectStore('files');
    console.log("Initiated Object Store");

    if (!files.length) {
        alert('Please select a folder to upload.');
        return;
    }

    await storeGitFiles(files);
    setFirstBuild(true)
    setHasFiles(true)
    setShowEditor(true)
};

  function rearrangeComponents(sourceCode, currentStackCopy, originalStack) {
    // Check old code to see if it is different from stack
    let results = parseChildren(sourceCode)
    let children = []
    for (let i=0;i<results.length;i++) {
      children.push(results[i].name)
    }
  
    let newTree = []
    if (children.length > 0) {
      for (let i=0;i<children.length;i++) {
        function checkCase(character) {
          if (character === character.toUpperCase()) {
            return 1
          } else if (character === character.toLowerCase()) {
            return 2
          } else {
            return 3
          }
        }
        if (checkCase(children[i][0]) === 1) {
          newTree.push(children[i])
        }
      }
    }

    console.log(newTree)
    console.log(currentStackCopy)

    // loop through code component tree to see if indexes match with stack
    let matches = true;
    if (newTree.length !== currentStackCopy.length) {matches = false} 
    let highestVal = newTree.length
    if (currentStackCopy.length < newTree.length) {highestVal = currentStackCopy.length}
    else {
      for (let i=0;i<highestVal;i++) {
        if (newTree[i] !== currentStackCopy[i]) {
          matches = false
        }
      }
    }

    if (!matches) {
      console.log("matching...")
      let remainder = sourceCode
      console.log(sourceCode)
      let pieces = []
      let firstPiece = ""
      let tracker = 0
      for (let j=0;j<originalStack.length;j++) {
        tracker = j
        let regex = new RegExp(`<\\s*${originalStack[j]}(\\s+|\\/)`);
        let match = regex.exec(remainder).index
        if (j===0) {
          firstPiece = remainder.substring(0, match);
          remainder = remainder.substring(match);
          console.log(remainder)
        }
        else {
          let match = regex.exec(remainder).index
          pieces.push(remainder.substring(0, match).trim())
          remainder = remainder.substring(match);
        } 
      }

      // Last component
      let lastPiece = ""
      let regex = new RegExp(`<\\s*\\/>`);
      let match = regex.exec(remainder).index

      pieces.push(remainder.substring(0, match).trim())
      lastPiece = "\n" + remainder.substring(match);

      console.log(firstPiece)
      console.log(pieces)
      console.log(lastPiece)


      // Return Code Pieces
      return [firstPiece, pieces, lastPiece]
      
    }
  }

  async function deleteComponent(index) {
    const isConfirmed = window.confirm(`Delete component ${currentStack[currentPage][index]}?`);
    if (isConfirmed) {
      // Step 1: Remove from Page file
      await removeComponentFromPage(pageNames[currentPage], currentStack[currentPage][index])
            
      // Step 2: Delete File
      await deleteFile(`${projectTitle}/src/components/${currentStack[currentPage][index]}/${currentStack[currentPage][index]}.js`)
      await deleteFile(`${projectTitle}/src/components/${currentStack[currentPage][index]}/${currentStack[currentPage][index]}.css`)
      
      // Step 3: Update Stack
      stackComponentDeletion(index)
      // keep track of the component files!! don't forget
      
      await handleBuild("");
    }
  }

  function stackComponentDeletion(dataIndex) {
    let copy = []
    for (let i=0;i<currentStack[currentPage].length;i++) {
      let dataIndexVal = dataIndex * 1
      if (i !== dataIndexVal) {
        copy.push(currentStack[currentPage][i])
      }
    }
    let currentStackCopy = currentStack
    currentStackCopy[currentPage] = copy
    setCurrentStack(currentStackCopy)
  }

  async function removeComponentFromPage(pageName, componentName) {
    // Alter page to remove import 
    let appjs = null;
    try {
      appjs = await retrieveFileByPath(`${projectTitle}/src/pages/${pageName}/${pageName}.js`)
    } catch {appjs = null}

    if (appjs !== null) {
      let currentCode = appjs
      console.log(currentCode)
      
      function removeImport(inputString) {
        const lines = inputString.split('\n');
        const modifiedLines = lines.filter(line => !line.trim().startsWith(`import ${componentName}`));
        const modifiedString = modifiedLines.join('\n');
        return modifiedString;
      }

      let newValue = removeImport(currentCode)

      // Remove the route
      function removeTag(inputString) {
        const pattern = new RegExp(`<\\s*${componentName}\\s*\\/\\s*>`, 'g');
        return inputString.replace(pattern, '');
      }
      newValue = removeTag(newValue)
      try {
        console.log(newValue)
        await storeFile(`${projectTitle}/src/pages/${pageName}/${pageName}.js`, newValue)
        setFile(null)
        setOpenFileNum(null)
        setOpenFiles([])
      } catch (error) {console.log(error)}
    }
  }

  // Pages 
  function changePage(value) {
    try {
      const iframe = frameRef.current.querySelector('iframe');
      if (iframe && iframe.contentWindow.history) {
        // Use the history object to navigate within the iframe
        console.log("trying")
        iframe.contentWindow.history.pushState(null, null, `/${value}`);
      } else {
        console.error('Iframe or history not found');
      }
    } catch(error) {console.log(error)}
  }

  async function addPage() {
    // Check if component is already in the stack and rename
    console.log(pageNames)
    let componentName = "Page"

    function sanitizeComponentName(input) {
      try {
        // Remove leading and trailing whitespaces
        let sanitizedInput = input.trim();
    
        // Ensure the name starts with a letter
        if (!/^[a-zA-Z]/.test(sanitizedInput)) {
          throw new Error("Component name must start with a letter.");
        }
    
        // Make first cahracter upper case
        sanitizedInput = sanitizedInput.charAt(0).toUpperCase() + sanitizedInput.slice(1);
        // Replace invalid characters with underscores
        sanitizedInput = sanitizedInput.replace(/[^a-zA-Z0-9_]/g, '_');
    
        return sanitizedInput;
      } catch (error) {
        console.warn("Invalid component name:", error.message);
        return null;
      }
    }
    
    const userInput = window.prompt("Page Name");

    if (userInput) {
      const name = sanitizeComponentName(userInput);

      if (name) {
        // Use the sanitized component name
        console.log("Component Name:", name);
        componentName = name
      } else {
        // Handle the case where the input was invalid
        console.log("Invalid input. Please enter a valid JSX component name.");
      }
    } else {return}

    let originalComponentName = componentName
    if (pageNames.includes(componentName)) {
      let i = 2
      let done = false
      let newName = componentName
      while (!done) {
        newName = componentName + "_" + i
        if (pageNames.includes(newName)) {
          i += 1
        } else {done = true}
      }
      componentName = newName
    }

    let pageNamesCopy = pageNames
    pageNamesCopy.push(componentName)
    setPageNames(pageNamesCopy)
    setUpdateStackNum(updateStackNum + 1)
    console.log(pageNamesCopy)
 
    async function createFileAndAddToFilesArray(componentName) {
      // Create some content for the file (you can modify this based on your needs)
      function capitalizeFirstLetter(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
      }
      
      // Example usage:
      const originalString = componentName;
      const capitalizedString = capitalizeFirstLetter(originalString);
      console.log(capitalizedString); // Output: "Hello"
      const fileContent = `import { Link } from 'react-router-dom';
    
      function ${componentName}() {
        return (
          <>
            <Link to="/"><button>Back to Home</button></Link>
          </>
        );
      }
      
      export default ${componentName};
      
      `;
    
      // Convert the content to a Blob
      const blob = new Blob([fileContent], { type: 'text/javascript' });
    
      // Create a new File object
      const filePath = `${projectTitle}/src/pages/${componentName}/${componentName}.js`;
    
      // Use fileUtils function to store the file in IndexedDB
      await storeFile(filePath, blob);
    }
    
    // Call the function
    await createFileAndAddToFilesArray(componentName);

    let found = false
    for (let i=0;i<openFiles.length;i++) {
      if (openFiles[i].path === `${projectTitle}/src/pages/${componentName}/${componentName}.js`) {
        // File is already open
        found = true
        setOpenFileNum(i)
        setFile( openFiles[i] )
      }
    }

    let appjs = null;
    try {
      appjs = await retrieveFileByPath(`${projectTitle}/src/App.js`)
      if (!found && appjs !== null) {
        await handleFileOpen(`${projectTitle}/src/App.js`)
      }
    } catch {appjs = null}

    if (appjs !== null) {
      let currentCode = appjs

      let importedValues = []
      let imports = currentCode.split("import ")
      if (imports.length > 0) {
        for (let j=0;j<imports.length;j++) {
          let constituents = imports[j].split(" ")
          if (constituents.length > 0) {
            importedValues.push(constituents[0])
          }
        }
      }

      let newValue = currentCode
    
      // If component is not already imported 
      if (!importedValues.includes(componentName)) {
        newValue = `import ${componentName} from './pages/${componentName}/${componentName}.js'` + "\n" + currentCode
      }

      let extension = componentName.toLowerCase()
      function insertRoute(sourceCode, componentName) {
        // Define a regular expression to find the position to insert the component
        const insertPositionRegex = /<Routes\s*>/;
        const match = sourceCode.match(insertPositionRegex);
        let updatedSourceCode = sourceCode
        if (match) {
          
          // Example usage:
          const originalString = componentName;
            
          const insertionIndex = match.index + match[0].length;
            let insertCode = `\n<Route path='/${extension}' element={<${componentName}/>} />`
            updatedSourceCode = sourceCode.slice(0, insertionIndex) + insertCode + sourceCode.slice(insertionIndex);
          }
        return updatedSourceCode
      }
      
        
      // Add the tag to App.js
      newValue = insertRoute(newValue, componentName)
      try {
        await storeFile(`${projectTitle}/src/App.js`, newValue)
        setFile(null)
        setOpenFileNum(null)
        setOpenFiles([])

        console.log(newValue)
        let componentCode = null
        try {componentCode = await retrieveFileByPath(`${projectTitle}/src/pages/${componentName}/${componentName}.js`)
        } catch {componentCode = null}
        
        if (componentCode) {
          let regex = new RegExp(originalComponentName, 'g');
          componentCode = componentCode.replace(regex, componentName);  

          console.log(componentCode)
          setFile(null)
          setOpenFileNum(null)
          setOpenFiles([])

          await handleBuild(newValue)
        }
      
      } catch (error){console.log(error)}
      monacoAutoformat()
      let currentStackCopy = currentStack
      currentStackCopy.push([])
      setCurrentStack(currentStackCopy)
      changePage(extension)
    }
  };

  async function deletePage(index) {
    const isConfirmed = window.confirm(`Delete page ${pageNames[index]}?`);
    if (isConfirmed) {
      // Step 1: Remove import from App.js
      await removePageFromAppJS(pageNames[index])
            
      // Step 2: Delete File
      await deleteFile(`${projectTitle}/src/pages/${pageNames[index]}/${pageNames[index]}.js`)
      
      // Step 3: Update Stack
      stackDeletion(index)
      // keep track of the component files!! don't forget
    }
  }

  async function removePageFromAppJS(componentName) {
    // Alter App.js to remove import 
    let appjs = null;
    try {
      appjs = await retrieveFileByPath(`${projectTitle}/src/App.js`)
    } catch {appjs = null}

    if (appjs !== null) {
      let currentCode = appjs
      
      function removeImport(inputString) {
        const lines = inputString.split('\n');
        const modifiedLines = lines.filter(line => !line.trim().startsWith(`import ${componentName}`));
        const modifiedString = modifiedLines.join('\n');
        return modifiedString;
      }

      let newValue = removeImport(currentCode)

      // Remove the route
      function removeRoute(inputString) {
        let pathValue = "/" + componentName.toLowerCase()
        const pattern = new RegExp(`<Route\\s+path='${pathValue}'\\s+element={<${componentName}\\/>} \\/>`, 'g');
        return inputString.replace(pattern, '');
      }
      newValue = removeRoute(newValue)
      try {
        console.log(newValue)
        await storeFile(`${projectTitle}/src/App.js`, newValue)
        setFile(null)
        setOpenFileNum(null)
        setOpenFiles([])
      } catch (error) {console.log(error)}
    }
  }

  async function redirect(value) {
    try { await handleBuild('')
    } catch (error){console.log(error)}
    changePage(value)
  };

  function stackDeletion(dataIndex) {
    console.log(pageNames)
    console.log(currentStack)
    let pageNamesCopy = []
    let currentStackCopy = []
    for (let i=0;i<pageNames.length;i++) {
      let dataIndexVal = dataIndex * 1
      if (i !== dataIndexVal) {
        pageNamesCopy.push(pageNames[i])
        currentStackCopy.push(currentStack[i])
      }
    }
    console.log(pageNamesCopy)
    console.log(currentStackCopy)
    setPageNames(pageNamesCopy)
    setCurrentStack(currentStackCopy)
  }

  // Parsing JSX
  function parseChildren(jsx) {

     function pattern1(inputString) {
      const pattern = /<>/;
      const match = inputString.match(pattern);
    
      if (match) {
        const startIndex = match.index + match[0].length;
        const followingText = inputString.slice(startIndex);
        return followingText;
      } else {
        return inputString;
      }
    }
    
    function pattern2(inputString) {
      const pattern = /<\/>/;
      const match = inputString.match(pattern);
    
      if (match) {
        const endIndex = match.index;
        const precedingText = inputString.slice(0, endIndex);
        return precedingText;
      } else {
        return inputString;
      }
    }
    
    const jsxString = "<div>" + pattern2(pattern1(jsx)) + "</div>" 
    const elementTree = parse(jsxString)[0];
    let elements = elementTree.children
    let children = []
    for (let i=0;i<elements.length;i++) {
      if (elements[i].type === "tag") {children.push(elements[i])}
    }
    console.log(children)
    return children
  }

  // Deployment
  const handleDeployment = async () => {
    console.log("Starting deployment")
    setDeploymentText("Deploying...")
    let files = await getFilesFromIndexedDB()
    let response = await sendFilesToServer(files)
  }

  async function getFilesFromIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ReactProjectsDatabase'); 
  
      request.onsuccess = (event) => {
          const db = event.target.result;
          const transaction = db.transaction(['files'], 'readonly');
          const objectStore = transaction.objectStore('files');
          const files = [];
          const cursorRequest = objectStore.openCursor();
      
          cursorRequest.onsuccess = (e) => {
              const cursor = e.target.result;
              if (cursor) {
                  const file = cursor.value;
                  if (!file.filepath.includes("/node_modules")) {
                      files.push(file);
                  }
                  cursor.continue();
              } else {
                  resolve(files);
              }
          };
      
          cursorRequest.onerror = (e) => {
              reject(e.target.error);
          };
      }
  
      request.onerror = (event) => {
          reject(event.target.error);
      };
    });
  }

  async function sendFilesToServer(files) {
    try {
      const formData = new FormData();
      files.forEach((fileObj, index) => {
        const filePath = fileObj.filepath
        const file = new File([fileObj.content], filePath);

        const pathParts = filePath.split('/');
        const fileName = pathParts.pop();
        const relativePath = pathParts.join('/');

        formData.append("file", file);
        formData.append("filenames", `${relativePath}/${fileName}`);
      });

      // const socket = new WebSocket('ws://localhost:3001');

      // socket.onopen = () => {
      //   console.log('WebSocket connection opened.');
      // };

      // socket.onmessage = (event) => {
      //   console.log('Message from server:', event.data);
      // };

      // socket.onclose = (event) => {
      //   console.log('WebSocket connection closed:', event);
      // };
    
      // const response = await fetch('http://localhost:3001/upload-files', {
      const response = await fetch('https://reactaiserver.azurewebsites.net/upload-files', {
        method: 'POST',
        body: formData,
      });
    
      if (response.ok) {
        console.log('Deployment successful');
        setDeploymentText("Deploy")
        response.text().then(text => {
          console.log(text);
          window.open(text, '_blank');
          alert(text)
        });
      } else {
        console.error('Error sending files to the server.');
        console.log(response) 
        setDeploymentText("Deploy")
      }
    } catch (error) {
        console.error('An error occurred:', error);
        setDeploymentText("Deploy")
    }
  }

  return (
    <div style={{width: "100vw", marginTop: "60px", height: "calc(100vh - 60px)", position: "fixed"}}>
      
      {/* Alert Message */}
      {warning && canShowWarning && <div style={{position: "absolute", height: "100%", width: "100vw", zIndex: 999}}>
        <div style={{pointerEvents: warning? "none" : "all", position: "absolute", height: "100%", width: "100%", backgroundColor: "black", opacity: 0.8}}></div>
        <div style={{position: "absolute", height: "100%", width: "100%", display: "flex", justifyContent: "center", alignItems: "center"}}>
          <OutsideClickDetector onOutsideClick={() => {handleOutsideClick()}}>
            <div style={{position: "relative", marginTop: "-15vh", height: "260px", width: "400px", borderRadius: "15px", backgroundColor: "black", border: "1px solid white", display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", gap: "4px"}}>
              {canCloseWarning && <div className="hover-dim" style={{position: "absolute", top: "10px", right: "10px", cursor: "pointer"}} onClick={()=>{setWarning(false); setWarningText3("")}} ><IoClose color="white" size={35}/></div>}
              <div style={{width: "80%", color: "white", fontSize: "30px", fontWeight: "bold", textAlign: "center"}}>
                {warningText1}
              </div>
              <div style={{width: "80%", color: "#999", fontSize: "20px", fontWeight: "100", textAlign: "center"}}>
                {warningText2}
              </div>
              {displayWarningProgress && <div style={{width: "76%", margin: "3px 0"}} className="progress-bar">
                <div className="progress" style={{ width: `${storingProgress}%` }}>
                </div>
              </div>}
              <div style={{width: "80%", color: "white", fontSize: "20px", fontWeight: "100", textAlign: "center"}}>
                {warningText3}
              </div>
            </div>
          </OutsideClickDetector>
        </div>
      </div>}

      {/* Clean Up */}
      <div style={{position: "absolute", height: "24.5px", width: "20px", right: "50vw", zIndex: 9, backgroundColor: "black"}}>
      </div>          

      {/* Settings Window */}
      {dotsOpen &&  <OutsideClickDetector onOutsideClick={() => {handleOutsideClick2()}}>
        <div style={{position: "absolute", right: 0, height: "calc(100% - 41px)", width: "50%", bottom: "41px", backgroundColor: "black", borderLeft: "1px solid white", zIndex: 998, display: "flex", flexDirection: "column", gap: "10px", padding: "20px 17px", paddingTop: "30px"}}>
          <div className="hover-dim" style={{position: "absolute", top: "10px", right: "10px", cursor: "pointer"}} onClick={()=>{setDotsOpen(false)}} ><IoClose color="white" size={35}/></div>
          
          <div style={{color: "white", fontSize: "28px", fontWeight: "600"}}>Your Project</div>     
         
          <div style={{width: "100%", marginBottom: "8px"}}>
            <button style={{width: "100%", whiteSpace: "nowrap", padding: "5px 10px", border: "1px solid white", color: "white", borderRadius: "7px", fontSize: "14px"}} 
              className="prompt-button hover-dim"
              onClick={()=>{handleDeployment()}}>
                {deploymentText}
                {displayWarningProgress && <div style={{ width: "100%", margin: "3px 0"}} className="progress-bar">
                <div className="progress" style={{ width: `${progress}%` }}>
                </div>
                </div>}
            </button> 
          </div>

          <div style={{width: "100%"}}>
            <button style={{width: "100%", whiteSpace: "nowrap", padding: "5px 10px", border: "1px solid white", color: "white", borderRadius: "7px", fontSize: "14px"}} 
              className="prompt-button hover-dim"
              onClick={()=>{handleExport()}}>
                {exportText}
                {displayWarningProgress && <div style={{ width: "100%", margin: "3px 0"}} className="progress-bar">
                <div className="progress" style={{ width: `${progress}%` }}>
                </div>
                </div>}
            </button> 
          </div>
     

          <div style={{marginTop: "15px", color: "white", fontSize: "16px", fontWeight: "400"}}>Current Model</div>     
         
          <button style={{whiteSpace: "nowrap",padding: "5px 10px", border: "1px solid white", color: "white", borderRadius: "7px", fontSize: "14px"}} 
            className="prompt-button hover-dim"
            onClick={()=>{switchModel()}}>
             gpt-{GPTModel}
          </button> 

          <div style={{marginTop: "15px", color: "white", fontSize: "16px", fontWeight: "400"}}>Model Renders</div>     
         
         <button style={{whiteSpace: "nowrap",padding: "5px 10px", border: "1px solid white", color: "white", borderRadius: "7px", fontSize: "14px"}} 
           className="prompt-button hover-dim"
           onClick={()=>{
              let maxLimit = 4;
              if (numberOfRenders >= maxLimit) {
                setRenderButtonWidths("100%")
                setNumberOfRenders(1)
              } else { 
                if (numberOfRenders === 1) {setRenderButtonWidths("50%")}
                else if (numberOfRenders === 2) {setRenderButtonWidths("33.33%")}
                else if (numberOfRenders === 3) {setRenderButtonWidths("25%")}
                setNumberOfRenders(numberOfRenders + 1) 
              }

            }}>
             <p style={{fontSize: "16px"}}>{numberOfRenders}</p>
         </button> 
         

         <div style={{marginTop: "15px", color: "white", fontSize: "16px", fontWeight: "400"}}>Model Temperature</div>     
         
         <button style={{display: "flex", justifyContent: "center", alignItems: "center", gap: "7px", flexDirection: "row", whiteSpace: "nowrap", padding: "5px 10px", border: "1px solid white", color: "white", borderRadius: "7px", fontSize: "14px"}} 
           className="prompt-button hover-dim"
           onClick={()=>{
              if (modelTemperature >= 0.9) {
                setModelTemperature(0.1)
              } else { 
                setModelTemperature(parseFloat((modelTemperature + 0.1).toFixed(1)));
              }
           }}>
            <p style={{marginTop: "-1px", fontSize: "16px"}}>{modelTemperature}</p>
            <p style={{fontSize: "13px", color: "#888"}}>{modelTemperature > 0.6? "HIGH" : modelTemperature > 0.3? "MODERATE" : "LOW"}</p>
         </button> 

        </div>
      </OutsideClickDetector>}

       {/* Options Window */}
       {optionsOpen &&  <OutsideClickDetector onOutsideClick={() => {handleOptionsOutsideClick()}}>
        <div style={{position: "absolute", left: "5px", height: "45px", width: "140px", bottom: "40px", backgroundColor: "black", border: "1px solid white", borderRadius: "13px", zIndex: 998, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "1.5px"}}>

          <button style={{ width: "100%", height: "100%", backgroundColor: "white", whiteSpace: "nowrap",padding: "6px 10px", color: "white", borderRadius: "10px", fontSize: "14px"}} 
            className="prompt-button hover-dim"
            onClick={async () => {
              setStoringProgress(0)
              setProgress(0)
              if (window.confirm('Create New Project?')) {
                // Blank Slate Protocol
                setCanCloseWarning(false)
                setWarning(true)
                setWarningText1("Building Project...")
                setWarningText2("Please wait, this may take a moment...")
                setDisplayWarningProgress(true)
                blankSlate = true;
                setOptionsOpen(false)

                setOpenFileNum(null); 
                currentFile = null
                setFile(null)
                setOpenFiles([])
                setSidebar(false)

                await handleBlankSlate()
                setSlate(1)
                blankSlate = false;
                setWarning(false)
                setDisplayWarningProgress(false)

                // Automatically exit full screen
                setFullScreen(false)
                setFullScreenText("Full Screen")

                // Initialize Build Mode
                setBuildingStack(true)
                setBuildModeStack(true)
                setSidebar(true)
              }
            }}>
              <p style={{fontSize: "16px", color: "black", fontWeight: "bold"}}>New Project</p>
                
          </button> 

        </div>
      </OutsideClickDetector>}

      {/* Left Sidbar */}
      <div 
        onClick={() => { 
          if (fullScreen) {
            setFullScreen(false) 
            setOptionsOpen(false)
          }
        }}
        style={{zIndex: 700, backgroundColor: "black", position: "absolute", top: 0, left: 0, width: "45px", height: "calc(100vh - 41px - 60px)", borderRight: "0.1px solid white", display: "flex", flexDirection: "column", alignItems: "center"}}>
        <FaBars className="hover-dim" title="Files" color="white" size={"21px"} style={{filter: buildModeStack? "brightness(0.7)" : "none", marginTop: "10px", cursor: "pointer"}} 
          onClick={async ()=>{
            setSelectedBuildComponent("")

            if (buildModeStack) {
              setSidebar(false)
              setBuildModeStack(false)
              setSelectedBuildComponent("")
              setOptionsOpen(false)
              setBuildingStack(false)
              try {
                await handleFileOpen(`${projectTitle}/src/App.js`)
                monacoAutoformat()
              } catch (error) {
                console.log(error)
              }
            } else {
              handleSidebar()
            }
          }}/>
        <FiEdit title="Build" color="white" size={"20px"} style={{filter: buildModeStack? "none" : "brightness(0.7)", marginTop: "14px", cursor: "pointer"}}
            className="prompt-button hover-dim"
            onClick={async () => { 
              if (buildModeStack) {
                if (buildModeStackRoute === "Page") {
                  handleSidebar()
                }
              } else {
                setBuildingStack(true)
                setSelectedBuildComponent("")
                setBuildModeStack(true)
                setOptionsOpen(false)
                setSidebar(true)
              }
            }}>
             <p style={{color: "black", fontWeight: "bold"}}>{buildingStack?  "Code Editor" : "Build Mode"}</p>
        </FiEdit> 
      </div>

      {/* Editor & Sidebar */}
      <div style={{width: "calc(50vw + 30px)", height: "calc(100% - 41px)", position: "absolute", display: "flex", flexDirection: "row"}}> 
          <div style={{width: sidebar? "180px" : "45px", height: "100%", backgroundColor: "black", borderRight: "0.1px solid white", display: "flex", flexDirection: "column", alignItems: "center"}}>
            {sidebar && <h1 className="select-none" style={{position: "absolute", top: "6px", left: "57px", color: "white", fontWeight: "500", fontSize: "23px"}}>Files</h1>}
            {sidebar && <div style={{position: "absolute", top: "38.8px", left: "45px", backgroundColor: "white", width: "150px", height: "0.5px"}}></div>}
            
            {sidebar && 
            <div style={{overflow: "scroll", position: "absolute", width: sidebar? "130px" : 0,  height: "calc(100% - 43px)", backgroundColor: "black", marginTop: "43px", cursor: "pointer", left: "49px"}}>
            <div className="file-tree" style={{ color: "white", padding: "0px 0px"}}>
              {Object.entries(tree).map(([nodeName, node]) =>
                renderTreeNode(node, nodeName)
              )}
            </div>
            </div>}
          </div>
    
         <div style={{height: "100%", width: sidebar? "calc(100% - 180px)" : "calc(100% - 45px)"}}>
            <div className="hide-scroll" style={{zIndex: 3,  height: "25px", width: "100%", borderBottom: "0.1px solid white", backgroundColor: "black", display: "flex", flexDirection: "row", overflow: "scroll"}}>
              
              {refreshCount > 0 && openFiles.map((item, index) => (
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
            <div onClick={()=>{setDotsOpen(false); setOptionsOpen(false)}} style={{height: "calc(100% - 25px)", paddingTop: "6px", backgroundColor: "black"}}>
              <Editor
                id="editor"
                ref={editorRef}
                onChange={()=>{
                  let fileOpened = openFileNum; 
                  handleEditorChange(fileOpened)
                }}
                height="100%"
                defaultLanguage = {openFileNum === null ?  "javascript" : file.language}
                value = {openFileNum === null ?  "" : file.value}
                path = {openFileNum === null ?  "/" : file.name}
                theme="hc-black"
                // theme="vs-dark"
                onMount={handleEditorDidMount}
                options={{
                  autoIndent: 11,
                  fontSize: 13.5, 
                  letterSpacing: 0.9,
                  inlineSuggest: 61,
                  lineNumbers: "on", 
                  lineNumbersMinChars: 3, 
                  wordWrap: "off",  
                  fontVariations: 53,
                  scrollBeyondLastLine: false,  
                  fontFamily: 48,
                  scrollbar: {
                    vertical: "hidden",
                    horizontal: "hidden",
                  },
                }}
                />
              </div>
          </div>
      </div>

      {/* Bottom Bar */}
      <div style={{zIndex: 2, backgroundColor: "black", borderTop: "0.1px solid white", position: "absolute", bottom: 0, left: 0, paddingLeft: "14px", height: "40px", width: "100vw", display: "flex", flexDirection: "row", borderTop: "0.1px solid black", gap: "6px", alignItems: "center"}}>
          <div style={{fontSize:"19px", height: "100%", display: "flex", alignItems: "center"}}>
          <CgPlayListAdd 
            title="New Project" 
            className="hover-dim question" 
            onClick={()=>{ 
              setOptionsOpen(!optionsOpen);
             }}
            color="white"
            size={"25px"}
            style={{cursor: "pointer", filter: "brightness(0.9)", marginTop: "-1px", marginRight: "10px"}}/>
        
            
            {!fullScreen? 
            <BsWindow 
              title="Full Screen"
              color="white" 
              size={"19px"}
              className="hover-dim"
              onClick={() => { 
                setFullScreen(true) 
                setOptionsOpen(false)
              }}
              style={{cursor: "pointer", marginTop: "-2px", marginRight: "-3px"}}/> 
            : 
            <BsWindowSplit 
              color="white" 
              title="Half Screen"
              className="hover-dim"
              size={"19px"} 
              onClick={() => { 
                setFullScreen(false) 
                setOptionsOpen(false)
              }}
              style={{cursor: "pointer", marginTop: "-2px", marginRight: "-3px"}}/>
          }
            
          </div>
          
          {selectedBuildComponent !== "" && <> <div className="hover-dim" onClick={()=>{
            setAIMode(AIMode === "ADD"? "ALTER" : "ADD")
          }} style={{color: "white", cursor: "pointer", marginLeft: "12px", fontWeight: "500", filter: "brightness(85%)", border: "0.5px solid #999", borderRadius: "6px", padding: "3.8px 8px", display: "flex", flexDirection: "row", gap: "4px"}}>
            <p>{AIMode}</p> 
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

          {!isSubmitting && <div style={{fontSize: "27px", height: "100%", width: "auto", display: "flex", alignItems: "center"}}>
            <BsArrowRightCircle ref={formRef} 
              title="Generate" color="white" size={"27px"}
              onClick={handleSubmit}
              className="hover-dim"
              style={{marginLeft: "10px", cursor: "pointer", marginRight: "6px"}}
            /> 
          </div>}
          
          </>}

          <div id="lottie-container-1" style={{display: isSubmitting? "block" : "none", pointerEvents: "none", backgroundColor: "transparent", height: "100px", minWidth: "100px", width: "100px", padding: 0, margin: 0, marginRight: "-25px"}}></div>
          
          <div style={{marginLeft: selectedBuildComponent !== ""? 0 : "calc(100vw - 131px)", fontSize: "27px", height: "100%", width: "auto", display: "flex", alignItems: "center"}}>
            <SiReact 
              title="Display" color="white" size={"27px"}
              style={{cursor: "pointer"}}
              className="hover-dim"
              onClick={handleBuild}
            /> 
          </div>
          <div style={{fontSize: "19px", height: "100%", width: "auto", display: "flex", alignItems: "center"}}>
            <BsThreeDotsVertical title="Options" 
              className="hover-dim" color="white" 
              style={{marginRight: "8px", cursor: "pointer"}}
              onClick={() => {setDotsOpen(!dotsOpen)}}
            />
          </div>

      </div>

      {/* Display */}
      <div 
        style={{zIndex: 10, position: "absolute", width: fullScreen? "calc(100vw - 45px)" : "50vw", marginLeft: fullScreen? "45px" : "50vw", height: "calc(100vh - 41px - 60px)", borderLeft: "0.1px solid white"}} >
        {hasRunOnce && !buildModeStack &&
          <div style={{width: "100%", backgroundColor: "black", height: "25px", display: "flex", flexDirection: "row"}}>
          <div title="Revert" style={{width: "25px", borderRight: "1px solid white", color: "white", fontSize: "12px", display: "flex", justifyContent: "center", alignItems: "center"}} 
            className="prompt-button hover-dim"
            onClick={()=>{handleFrameChange(0)}}>
            <IoChevronBack color="white" size={"25px"}/>
          </div>
          <div style={{width: "calc(100% - 25px)", height: "100%", display: "flex", flexDirection: "row", backgroundColor: "black"}}>
            {numberOfRenders !== 1 && <div style={{userSelect: "none", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", width: renderButtonWidths, height: "100%", filter: currentFrame === 1? "brightness(80%)" : "brightness(45%)", borderRight: "1px solid white", color: "white", fontSize: "19px"}} 
              className={` ${currentFrame === 1 ? "prompt-button" : "prompt-button hover-dim"}`}
              onClick={()=>{handleFrameChange(1)}}> 
              1
            </div>}
            {numberOfRenders >= 2 && <div style={{userSelect: "none", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", width: renderButtonWidths, height: "100%", filter: currentFrame === 2? "brightness(80%)" : "brightness(45%)", borderRight: "1px solid white", color: "white", fontSize: "19px"}} 
              className={` ${currentFrame === 2 ? "prompt-button" : "prompt-button hover-dim"}`}
              onClick={()=>{handleFrameChange(2)}}>
              2
            </div>}
            {numberOfRenders >= 3 && <div style={{userSelect: "none", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", width: renderButtonWidths, height: "100%", filter: currentFrame === 3? "brightness(80%)" : "brightness(45%)", borderRight: "1px solid white", color: "white", fontSize: "19px"}} 
              className={` ${currentFrame === 3 ? "prompt-button" : "prompt-button hover-dim"}`}
              onClick={()=>{handleFrameChange(3)}}>
              3
            </div> }
            {numberOfRenders >= 4 && <div style={{userSelect: "none", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", width: renderButtonWidths, height: "100%", filter: currentFrame === 4? "brightness(80%)" : "brightness(45%)", color: "white", fontSize: "19px"}} 
              className={` ${currentFrame === 4 ? "prompt-button" : "prompt-button hover-dim"}`}
              onClick={()=>{handleFrameChange(4)}}>
              4
            </div> }
          </div>
        </div>}
        
        <div style={{display: draggable? "block" : "none", width: "calc(100% - 3px)", height: "100%", position: "absolute", top: 0, left: 0, zIndex: 900}}>
          {draggable && <Canvas/>}
          <div style={{zIndex: 200, position: "absolute", top: 0, left: 0, marginTop: yVal, marginLeft: xVal, width: `${width}px`, height: `${height}px`, backgroundColor: "red"}}></div>
        </div>
    
        <div ref={frameRef} style={{width: draggable ? "calc(100% - 3px)" : "100%", height: "100%", backgroundColor: displayColor}}>
        </div>

      </div>

      {/* Build Mode Alert */}
      {buildMode && canShowBuildMode && <div style={{position: "absolute", height: "100%", width: "50vw", zIndex: 900}}>
        <div style={{position: "absolute", height: "100%", width: "100%", backgroundColor: "black", opacity: 0.4}}></div>
          <div style={{position: "absolute", height: "100%", width: "100%", display: "flex", justifyContent: "center", alignItems: "center"}}>
              <div style={{position: "relative", marginTop: "-15vh", height: "260px", width: "400px", maxWidth: "80%", borderRadius: "15px", backgroundColor: "black", border: "1px solid white", display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", gap: "10px"}}>
                <div className="hover-dim" style={{filter: "brightness(0.5)", position: "absolute", top: "10px", right: "10px", cursor: "pointer"}} onClick={()=>{setBuildMode(false); setBuildingStack(false); setDisplayColor("white")}} ><IoClose color="white" size={35}/></div>
                <div style={{width: "80%", color: "white", fontSize: "30px", fontWeight: "bold", textAlign: "center"}}>
                  {BuildAlert1Text}
                </div>
                <div 
                  className="hover-dim" 
                  onClick={async ()=>{
                    setBuildMode(false); 
                    setBuildModeStack(true); 
                    setSidebar(true)
                    setCurrentStack([[]])
                    setDisplayColor("white")
                    
                    // Open Blank Slate
                    editorRef.current.setValue(emptyAppJS);
                    await handleBuild()

                  }} style={{cursor: "pointer", maxWidth: "190px", width: "80%", backgroundColor: "white", fontSize: "20px", fontWeight: "bold", padding: "9px 25px", whiteSpace: "nowrap", border: "1px solid white", borderRadius: "16px", fontWeight: "100", textAlign: "center"}}>
                  <p style={{color: "black", fontWeight: "bold"}}>{BuildButton1Text}</p>
                </div>
               
                {/* {displayWarningProgress && <div style={{width: "76%", margin: "3px 0"}} className="progress-bar">
                  <div className="progress" style={{ width: `${storingProgress}%` }}>
                  </div>
                </div>}
                <div style={{width: "80%", color: "white", fontSize: "20px", fontWeight: "100", textAlign: "center"}}>
                  {warningText3}
                </div> */}
              </div>

        </div>
      </div>}

      {/* Build Mode */}
      {buildModeStack && !fullScreen && 
      <div style={{position: "absolute", height: "calc(100% - 40px)", width: "calc(50vw + 0.1px)", zIndex: 600}}>
        <div className="select-none" style={{zIndex: 600, width: "100%", height: "100%", borderBottom: "0.1px solid white", borderRight: "2px solid black", position: "absolute", display: "flex", flexDirection: "row"}}> 
          <div className="select-none" style={{userSelect: "none", zIndex: 600, marginLeft: "45px", width: sidebar? "135px" : "0px", height: "100%", backgroundColor: "black", borderRight: "0.1px solid white", display: "flex", flexDirection: "column", alignItems: "center"}}>
            {sidebar && buildModeStackRoute === "Pages" && <h1 className="select-none" style={{position: "absolute", top: "6px", left: "57px", color: "white", fontWeight: "500", fontSize: "23px"}}>Pages</h1>}
            {sidebar && buildModeStackRoute === "Pages" && <div style={{position: "absolute", top: "38.8px", left: "45px", backgroundColor: "white", width: "135px", height: "0.5px"}}></div>}
            {sidebar && buildModeStackRoute === "Pages" && <div className="select-none" style={{paddingRight: "10px", overflow: "scroll", position: "absolute", width: sidebar? "130px" : 0, height: "calc(100% - 40px)", backgroundColor: "transparent", marginTop: "39px"}}>
              <div>
                  {pageNames.length === 0? 
                  <div 
                    onClick={()=>{addPage()}} 
                    className="hover-dim" style={{marginTop: "9px", marginLeft: "10px",cursor: "pointer", width: "calc(100% - 10px)", height: "33px", backgroundColor: "black", border: "1px solid white", borderRadius: "7px", display: "flex", justifyContent: "center", alignItems: "center"}}>
                    <HiPlusSm style={{marginLeft: "-10px", marginTop: "-2px"}} color="white" fontSize={28} />
                    <p style={{marginLeft: "-3px", color: "white", fontWeight: "bold", fontFamily: "sans-serif"}}>
                      Page
                    </p>
                  </div>
                  : 
                  <>
                    <div className="select-none" > 
                      <div className="select-none" style={{userSelect: "none", paddingBottom: "50px", marginTop: "13px"}}>
                        {updateStackNum > 0 && <PagesDraggableList>
                        </PagesDraggableList>}
                        
                        <div 
                          onClick={()=>{addPage()}} 
                          className="hover-dim" style={{marginTop: "9px", marginLeft: "10px",cursor: "pointer", width: "calc(100% - 10px)", height: "33px", backgroundColor: "black", border: "1px solid white", borderRadius: "7px", display: "flex", justifyContent: "center", alignItems: "center"}}>
                          <HiPlusSm style={{marginLeft: "-10px", marginTop: "-2px"}} color="white" fontSize={28} />
                          <p style={{marginLeft: "-3px", color: "white", fontWeight: "bold", fontFamily: "sans-serif"}}>
                            Page
                          </p>
                        </div>

                      </div>
                    
                    </div>
                  </>
                }
              </div>
            </div>}
        

            {sidebar && buildModeStackRoute === "Page" && 
            <>
              <BsChevronLeft 
                onClick={()=>{
                  setBuildModeStackRoute("Pages")
                  setSelectedBuildComponent("")
                  const iframe = frameRef.current.querySelector('iframe');
                  if (iframe && iframe.contentWindow.location) {
                    const currentNavigation = iframe.contentWindow.location.href;
                    const segments = currentNavigation.split('/');
                    const lastWord = segments[segments.length - 1];
                    if (lastWord !== "") {redirect("")}
                  } 
                  
                }} style={{cursor: "pointer", marginTop: "8.8px", marginLeft: "-100px"}} size={21} color="white"/>
              <h1 className="select-none" style={{marginLeft: "20px", position: "absolute", top: "6px", left: "57px", color: "white", fontWeight: "500", fontSize: "23px"}}>{pageNames[currentPage]}</h1>
              <div style={{position: "absolute", top: "38.8px", left: "45px", backgroundColor: "white", width: "135px", height: "0.5px"}}></div>
              
              <div className="select-none" style={{paddingRight: "10px", overflow: "scroll", position: "absolute", width: sidebar? "130px" : 0, height: "calc(100% - 40px)", backgroundColor: "transparent", marginTop: "39px"}}>
                <div>
                    {currentStack[currentPage] && currentStack[currentPage].length === 0? 
                    <div className="hover-dim" onClick={()=>{setSidebar(false)}} style={{marginTop: "10px", marginLeft: "10px", cursor: "pointer", width: "calc(100% - 10px)", height: "33px", backgroundColor: "black", border: "1px solid white", borderRadius: "7px", display: "flex", justifyContent: "center", alignItems: "center"}}>
                      <HiPlusSm style={{marginLeft: "-10px", marginTop: "-3px"}} color="white" fontSize={26} />
                      <p style={{marginLeft: "-3px", marginTop: "-2px", color: "white", fontWeight: "bold", fontFamily: "sans-serif", fontSize: "14px"}}>
                        Component
                      </p>
                    </div>
                    : 
                    <div className="select-none" > 
                      <div className="select-none" style={{userSelect: "none", paddingBottom: "50px", marginTop: "13px"}}>
                        {updateStackNum > 0 && <DraggableList>
                        </DraggableList>}
                      </div>
                    
                    </div>
                  }
                </div>
              </div>
            </>}

          </div>

          <div style={{height: "100%", width: sidebar? "calc(100% - 180px)" : "calc(100% - 45px)", backgroundColor: "black"}} onClick={()=>{setDotsOpen(false); setOptionsOpen(false)}} >
          {buildModeStackRoute === "Page" && <>
              <h2 style={{color: "white", padding: "5px 10px"}} onClick={()=>{setDraggable(!draggable)}}>Components</h2>
              {componentData.length > 0 && componentData.map((componentFile, index) => (
              <>
                {/* <h3 style={{color: "white", marginLeft: "10px"}}>{componentFile[index]}</h3> */}
                <div style={{zIndex: 3,  height: "120px", width: "100%", borderTop: "0.1px solid white", borderBottom: "0.1px solid white", backgroundColor: "black", display: "flex", flexDirection: "row", overflow: "scroll"}}>
                  {componentData[componentData.length - 1 - index][1] && componentData[componentData.length - 1 - index][1].map((item, index) => (
                    <div 
                      key={index}
                      className="hover-dim hide-scroll"
                      onClick={async ()=>{
                        if (canSelect) {
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
                            // Open up App.js if it exists
                            let appjs = null;
                            try {appjs = await retrieveFileByPath(`${projectTitle}/src/App.js`)
                            } catch {appjs = null}
                            if (appjs !== null) {
                              await handleFileOpen(`${projectTitle}/src/App.js`)
                            }
                          }
                          canSelect = false
                          setUpdateStackNum(updateStackNum + 1)
                          let component = item.component
                          addComponent(component)
                          setSidebar(true)
                          canSelect = true
                        }
                      }}
                      style={{padding: "20px", height: "100%", width: "150px", minWidth: "150px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "3px", backgroundColor: "transparent", borderRight: "0.1px solid white", cursor: "pointer"}}>
                      <p style={{userSelect: "none", color: "white", fontSize: "15px", fontWeight: "500", fontFamily: "sans-serif", whiteSpace: "nowrap", textOverflow: "ellipsis"}}>{item.component}</p>
                      <img style={{width: "100%", maxHeight: "80px", objectFit: "cover"}} src={navbars[0].img} alt=""/>
                  </div>
                  ))}
                </div>
              </>
              ))}
            </>}
          </div>

        </div>
      </div>}


      
    </div>
  );
};

export default ReactAI;





