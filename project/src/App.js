import ReactAI from "./ReactAI/ReactAI"
import Upload from "./Upload/Upload"
import Header from "./Header/Header"
import { useHasFilesStore, useShowEditorStore, useShowGPTStore, useShowUploadStore } from "./activitiesStore";
import { useEffect } from "react";

function App() {  
  var hasFiles = useHasFilesStore((state) => state.hasFiles);
  const setHasFiles = useHasFilesStore((state) => state.setHasFiles);

  var showEditor = useShowEditorStore((state) => state.showEditor);
  const setShowEditor = useShowEditorStore((state) => state.setShowEditor);

  var showGPT = useShowGPTStore((state) => state.showGPT);
  const setShowGPT = useShowGPTStore((state) => state.setShowGPT);

  var showUpload = useShowUploadStore((state) => state.showUpload);
  const setShowUpload = useShowUploadStore((state) => state.setShowUpload);

  useEffect(()=>{   
     openIndexedDB()
  },[])

  // CHECK DATABASE FOR EXISTING PROJECT
  function openIndexedDB() {
    let promise = new Promise((resolve, reject) => {
      const request = indexedDB.open('ReactProjectsDatabase', 1);

      request.onerror = event => {
        reject(false);
      };

      request.onsuccess = event => {
        const db = event.target.result;
        if (db.objectStoreNames.length > 0) {
          setHasFiles(true)
          setShowUpload(false)
        }
        resolve(true);
      };
    });
  }

  return (
    <>
      <Header/>
      {hasFiles && showEditor
        ? <ReactAI/> :  <Upload/>}
      </>
    );
}

export default App;
