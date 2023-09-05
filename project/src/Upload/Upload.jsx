import "./Upload.scss"
import { MdCloudUpload } from "react-icons/md"
import { BsGithub } from "react-icons/bs"
import React, { useRef, useEffect, useState } from "react";
import logo from "../assets/logo.png"
import axios from "axios";
import JSZip from 'jszip';
import { useHasFilesStore, useShowEditorStore, useShowGPTStore, useShowUploadStore, useFirstBuildStore } from "../activitiesStore"

function Upload() {
    var hasFiles = useHasFilesStore((state) => state.hasFiles);
    const setHasFiles = useHasFilesStore((state) => state.setHasFiles);
  
    var showEditor = useShowEditorStore((state) => state.showEditor);
    const setShowEditor = useShowEditorStore((state) => state.setShowEditor);
  
    var showGPT = useShowGPTStore((state) => state.showGPT);
    const setShowGPT = useShowGPTStore((state) => state.setShowGPT);
    
    var showUpload = useShowUploadStore((state) => state.showUpload);
    const setShowUpload = useShowUploadStore((state) => state.setShowUpload);
    
    var firstBuild = useFirstBuildStore((state) => state.firstBuild);
    const setFirstBuild = useFirstBuildStore((state) => state.setFirstBuild);

    // let image1 = "https://reactaiblobs.blob.core.windows.net/reactaistorage/replicate.png"
    let image1 = "https://socialwebappblobs.blob.core.windows.net/blobs/replicate.png"
    const [progress, setProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false)
    const [openProject, setOpenProject] = useState("Open Project")
    const fileInputRef = useRef(null);
    const [smallScreen, setSmallScreen] = useState(window.innerWidth < 800 ? true : false);
    const [codeContent, setCodeContent] = useState('');

    const handleUpload = async () => {
        const projectInput = document.getElementById('projectInput');
        indexedDB.deleteDatabase("ReactProjectsDatabase");
        console.log("Deleted database");

        const db = await openDatabase(); 
        const transaction = db.transaction('files', 'readwrite');
        const objectStore = transaction.objectStore('files');
        await objectStore.clear();
        console.log("Cleared database");

        const files = projectInput.files;
        if (!files.length) {
            alert('Please select a folder to upload.');
            return;
        }

        await storeFiles(files);
        setFirstBuild(true)
        setHasFiles(true)
        setShowEditor(true)
        setShowUpload(false)
    };

    // buildButton.addEventListener('click', async () => {
    //   console.log("Build")

    //   // const storedFiles = await retrieveFilePaths();
    //   // console.log('Retrieved Files:', storedFiles.length);

    //   // console.log(Array.from(storedFiles).slice(0, 10));
    //   const targetFilePath = 'react-app/node_modules/react/index.js'; // Adjust this to the desired file path
    //   try {
    //     // const storedFiles = await retrieveFilePaths();
    //     // console.log('Retrieved Files:', storedFiles.length);

    //     // const fileContent = await retrieveCodeByFilePath(targetFilePath);
    //     // console.log('Retrieved file content:', fileContent);
    //     const files = await retrieveFilePaths();
    //     console.log(files.length)

    //     // You can now use the retrieved file content as needed
    //   } catch (error) {
    //     console.error('Error retrieving file:', error);
    //   }
    // })

    async function storeFileBlob(fileBlob) {
        try {
          const zip = new JSZip(); // Assuming you're using a library like JSZip to work with the zip file
          const zipContents = await zip.loadAsync(fileBlob);
      
          const files = {}; // This object will hold individual file data
      
          // Loop through the files in the zip archive
          let promises = [];
          zipContents.forEach((relativePath, file) => {
            console.log(file);
            promises.push(new Promise(async (reject, resolve) => {
                try {
                    const fileData = await file.async('blob');
                    files[relativePath] = fileData;
                    resolve();
                } catch (e) {
                    console.log("FAILURE!!!");
                    reject(e);
                }
            }));
          });
          for (let promise of promises) {
            await promise;
          }
          console.log("got files")
          console.log(Object.keys(files));
      
          // Assuming you have a storeFiles method that takes the files object
          await storeFiles(files);
          console.log('Files stored successfully.');
        } catch (error) {
          console.error('Error storing files:', error);
        }
      }

    async function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('ReactProjectsDatabase', 1);

            request.onerror = event => {
                reject('Error opening database');
            };

            request.onsuccess = event => {
                const db = event.target.result;
                resolve(db);
            };

            request.onupgradeneeded = event => {
                const db = event.target.result;
                db.createObjectStore('files', { keyPath: 'filepath' });
                console.log("Created object store `files`");
            };
        });
    }

    async function storeFiles(files) {
        let filesList = Array.from(files)
        for (let i = 0; i < filesList.length; i += 1000) {
            let filesChunk = filesList.slice(i, i + 1000);
            await Promise.all(filesChunk.map(file => storeFile(file)));
            setProgress((i / filesList.length) * 100)
        }
    }

    async function storeFile(file) {
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

                    if (fileData.filepath.startsWith('react-project/node_modules/')) {
                        console.log(1)
                    }

                    const db = await openDatabase();
                    const transaction = db.transaction('files', 'readwrite');
                    const objectStore = transaction.objectStore('files');
                    await objectStore.put(fileData);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            };

            fileReader.readAsArrayBuffer(file);
        });
    }

    async function retrieveFilePaths() {
        return new Promise(async (resolve, reject) => {
            const db = await openDatabase();
            const transaction = db.transaction('files', 'readonly');
            const objectStore = transaction.objectStore('files');
            const request = objectStore.getAllKeys();

            request.onsuccess = event => {
                const storedFiles = event.target.result;
                resolve(storedFiles);
            };

            request.onerror = event => {
                reject('Error retrieving files');
            };
        });
    }

    async function retrieveCodeByFilePath(filepath) {
        return new Promise(async (resolve, reject) => {
            const db = await openDatabase();
            const transaction = db.transaction('files', 'readonly');
            const objectStore = transaction.objectStore('files');
            const request = objectStore.get(filepath);
            console.log("FILEPATH:", filepath)

            request.onsuccess = event => {
                console.log(event.target.result)
                const storedFile = event.target.result;
                if (storedFile) {
                    console.log(storedFile.content);
                    resolve(storedFile.content);
                } else {
                    reject('File not found');
                }
            };

            request.onerror = event => {
                reject('Error retrieving file');
            };
        });
    }

    // https://github.com/josephgoff-git/SeaBreeze

    // const fetchCodeFromGitHub = async (repositoryURL) => {
    //   try {
    //     const apiURL = repositoryURL.replace('github.com', 'api.github.com/repos');
    //     const response = await fetch(apiURL);
    //     const data = await response.json();
    //     const code = data.content;
    //     const decodedCode = atob(code);

    //     // Update state with the fetched code content
    //     setCodeContent(decodedCode);
    //     console.log(decodedCode)
    //   } catch (error) {
    //     // Handle any errors that occur during the fetch
    //     console.error('Error fetching code from GitHub:', error);
    //   }
    // };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        console.log("Dropped files:", files);
    };

    const handleClick = () => {
        fileInputRef.current.click();
        // setOpenProject("Opening Project...")
    };

    const handleChange = (e) => {
        const files = e.target.files;
        console.log("Selected files:", files);
        setOpenProject("Uploading Project...")
        setIsUploading(true)
        if (files) { handleUpload() }
    };

    useEffect(() => {
        const handleResize = () => {
            setSmallScreen(window.innerWidth < 800 ? true : false);
        };

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    const handleGitClick = async () => {
        let git_user = prompt("Enter repository owner's username:");
        let git_repo = null;
        if (git_user) {git_repo = prompt("Enter repository name");}
        let branch = null;
        if (git_user && git_repo) {
            try {
                const response = await axios.get(`https://api.github.com/repos/${git_user}/${git_repo}`);
                // let fullResponse = JSON.stringify(response.data, null, 2)
                branch = response.data.default_branch
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        }
        
        let download_link = null;
        if (branch !== null) {
            download_link = `curl -L http://github.com/${git_user}/${git_repo}/archive/${branch}.zip --output ${branch}.zip`
            downloadAndStore(branch, git_user, git_repo);
        }
    };

    async function downloadAndStore(branch, git_user, git_repo) {
        // const proxyUrl = 'http://localhost:3001/github-proxy';
        // const githubApiUrl = 'https://api.github.com/repos/josephgoff-git/seaBreeze/zipball/master';
    
        const proxyUrl = 'http://localhost:3001/github-proxy';
        const githubApiUrl = `https://api.github.com/repos/${git_user}/${git_repo}/zipball/${branch}`;
        
        try {
            const response = await axios.get(`${proxyUrl}?url=${encodeURIComponent(githubApiUrl)}`, {
                responseType: 'blob', 
            });
    
            indexedDB.deleteDatabase('ReactProjectsDatabase');
            console.log('Deleted database');
    
            const db = await openDatabase();
            const transaction = db.transaction('files', 'readwrite');
            const objectStore = transaction.objectStore('files');
            await objectStore.clear();
            console.log('Cleared database');
    
            if (response.data !== null) {
                await storeFileBlob(response.data);
                setHasFiles(true);
                setShowEditor(true)
                setShowUpload(false)
            }
        } catch (error) {
            console.error('Error downloading or storing the file:', error);
        }
    }
    
    return (
        <div className="app">
            <div style={{ zIndex: 1, userSelect: "none", width: "100vw", height: "calc(100vh - 60px)", position: "fixed", objectFit: "contain", marginTop: "60px" }}>
                <img loading='lazy' src={image1} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>

            <div style={{ display: "flex", flexDirection: smallScreen ? "column" : "row", zIndex: 3 }}>

                <div style={{
                    zIndex: 3,
                    width: "100%",
                    height: smallScreen ? "calc((100vh - 70px) * 0.41)" : "calc(100vh - 70px)",
                    backgroundColor: "transparent",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center"
                }}>
                </div>

                <div
                    style={{
                        marginTop: "70px",
                        zIndex: 3,
                        width: "100%",
                        height: smallScreen ? "calc((100vh - 70px) * 0.5)" : "calc(100vh - 70px)",
                        backgroundColor: "transparent",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        flexDirection: "column",
                        gap: "5%"
                    }}>

                    <div
                        className="upload-page-button"
                        style={{
                            width: "64%",
                            height: smallScreen ? "calc(20vw + 50px)" : "calc(7vw + 110px)",
                            backgroundColor: "black",
                            border: "0.1px solid #666",
                            borderRadius: "25px",
                            cursor: "pointer",
                            marginBottom: smallScreen ? "16px" : 0,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            flexDirection: "column",
                            marginLeft: smallScreen ? 0 : "6vw",
                            boxShadow: "0 0 15px #444"
                        }}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={handleClick}>
                        <input
                            type="file"
                            id="projectInput"
                            ref={fileInputRef}
                            style={{ display: "none" }}
                            multiple
                            directory="true"
                            webkitdirectory="true"
                            onChange={handleChange}
                        />
                        <div style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                        }}>
                            <p style={{ userSelect: "none", color: "white", fontSize: smallScreen ? "calc(2vw + 11px)" : "calc(1vw + 11px)", fontWeight: "700", opacity: 0.75 }}>{openProject}</p>
                            <MdCloudUpload fontSize={30} style={{ marginLeft: "15px", color: "white", opacity: 0.75 }} />
                        </div>

                        {isUploading && <div style={{ width: "69%", marginTop: "12px" }} className="progress-bar">
                            <div className="progress" style={{ width: `${progress}%` }}>
                            </div>
                        </div>}

                    </div>

                    <div
                        className="upload-page-button"
                        style={{
                            width: "64%",
                            height: smallScreen ? "calc(20vw + 50px)" : "calc(7vw + 110px)",
                            backgroundColor: "black",
                            border: "0.1px solid #666",
                            borderRadius: "25px",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            marginLeft: smallScreen ? 0 : "6vw",
                            boxShadow: "0 0 15px #444"
                        }}
                        onClick={handleGitClick}>
                        <div style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                        }}>
                            <p style={{ userSelect: "none", color: "white", fontSize: smallScreen ? "calc(2vw + 11px)" : "calc(1vw + 11px)", fontWeight: "700", opacity: 0.75 }}> Import From GitHub</p>
                            <BsGithub fontSize={30} style={{ marginLeft: "15px", color: "white", opacity: 0.75 }} />
                        </div>
                     </div>

                </div>

            </div>
        </div>
    );
}

export default Upload;