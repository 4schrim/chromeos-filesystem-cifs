# Code Structure

This document describes you code structure of this software. Mainly, I write down about the directory structure and the purpose of each file.

# Directory

* [/](https://github.com/yoichiro/chromeos-filesystem-cifs) - Build files, Configuration files, and etc.
* [/app](https://github.com/yoichiro/chromeos-filesystem-cifs/tree/master/app) - This directory has one HTML file and the manifest.json file.
* [/app/_locales/en](https://github.com/yoichiro/chromeos-filesystem-cifs/tree/master/app/_locales/en) - There is one message resource file for English.
* [/app/icons](https://github.com/yoichiro/chromeos-filesystem-cifs/tree/master/app.icons) - This directory has some image files.
* [/app/scripts](https://github.com/yoichiro/chromeos-filesystem-cifs/tree/master/app/scripts) - There are all JavaScript files.
* [/app/styles](https://github.com/yoichiro/chromeos-filesystem-cifs/tree/master/app/styles) - There is one css style sheet definition file.
* [/test](https://github.com/yoichiro/chromeos-filesystem-cifs/tree/master/test) - Currently, all files are garbage...
* [/docs](https://github.com/yoichiro/chromeos-filesystem-cifs/tree/master/docs) - Currently, there is one image file which is referenced by the README.md file.

At least, if you are a programmer, first you should enter the /app/scripts directory and see each JavaScript files to understand this app's behaviors.

# Files

## For Building

### [/Gruntfile.js](https://github.com/yoichiro/chromeos-filesystem-cifs/blob/master/Gruntfile.js)

This file defines all procedures to build this software with [grunt](http://gruntjs.com/).

### [/package.json](https://github.com/yoichiro/chromeos-filesystem-cifs/blob/master/package.json)

The building procedures are using many sub tasks for the grunt. This file defines the used sub tasks.

### [/bower.js](https://github.com/yoichiro/chromeos-filesystem-cifs/blob/master/bower.js)

This software is using [bower](http://bower.io/) to manage packages. This software is using [Polymer 0.5](https://www.polymer-project.org/0.5/), and this file defines each polymer components as depended packages.

### [/.jshintrc](https://github.com/yoichiro/chromeos-filesystem-cifs/blob/master/.jshintrc)

[JSHint](http://jshint.com/) is a software to check the JavaScript Code as a static code analyzing. This file defines each check rule. That is, this file has many flags to turn on/off each checking process. JSHint is executed by the grunt tool automatically, because the Gruntfile.js has the task to execute the JSHint.

## HTML

### [/app/window.html](https://github.com/yoichiro/chromeos-filesystem-cifs/blob/master/app/window.html)

This HTML file provides a screen to fill in a connection information. The connection information form consists of server host-name, the port number, user name, user password, the domain name, the shared resource name the user wants to mount and the root directory. When the user pushes the "KEEP" button, the connection information the user filled in is stored to the shared storage with [chrome.storage.local](https://developer.chrome.com/apps/storage#property-local) API. All stored information are displayed on the left pane.

This HTML elements consists of Polymer components. Each click event is handled by the function defined by /app/scripts/window.js file.

This window.html file has three dialogs.

#### Setting Dialog

First dialog is for setting some configurations. Actually, this dialog is the element which has the "settingsDialog" ID value. The configuration items are:

* Turn on/off whether keep the password the user filled in or not.
* Select the debug level from "Trace", "Info" and "Error".
* Select the max version of the SMB protocol from either 1 or 2.
* Select the LMCompatibilityLevel value between 0 and 5.

#### Shared Resource List Dialog

After authenticating the user, this software gets the shared resource list from the server, if the user didn't fill in the shared resource name on the window.html screen. Then, the Shared Resource List Dialog is opened, and the shared resource list is displayed on the dialog. The user has to select one shared resource and to click the "Connect" button. This dialog is the element which has the "selectSharedResourceDialog" ID value.

#### Service List Dialog

In the background context, it handles the multi-cast DNS (mDNS) event regarding SMB servers with the chrome.mdns API. This Service List dialog shows the user the retrieved server list. This dialog is the element which has the "serviceListDialog" ID value. If the user selects one server from the list, the server name is set into the connection information form.

## JavaScript

This software consists of many JavaScript files. The abstract structure is the following:

![code_structure_1.png](https://raw.githubusercontent.com/yoichiro/chromeos-filesystem-cifs/master/docs/code_structure_1.png)

The red blocks represents the classes which are in charge of handling the File System Provider API. The "SmbClient.*" blue block is a name space of classes which are implementations of SMB protocol. The SmbClient.* classes have a following structure:

![code_structure_1.png](https://raw.githubusercontent.com/yoichiro/chromeos-filesystem-cifs/master/docs/code_structure_2.png)

As the most low layer, the chrome.sockets.tcp API is used to communicate with the SMB server. 

[/app/scripts/metadata_cache.js](https://github.com/yoichiro/chromeos-filesystem-cifs/blob/master/app/scripts/metadata_cache.js)

This script provides an ability to keep metadata objects. As the result, whole performance is increased because of reducing a network communication. Each metadata object is stored per each directory. That is, the cache key is a directory path.

* put() - Store metadata object array to the cache storage mapped by the specified directory path.
* get() - Retrieve metadata object/array specified by the directory path/file path.
* remove() - Delete the metadata object/array specified by the directory path/file path.

[/app/scripts/metadata_cache.js](https://github.com/yoichiro/chromeos-filesystem-cifs/blob/master/app/scripts/task_queue.js)

This Class provides you an ability of a Queue Mechanism. You can register a new task, and the registered tasks will be executed sequentially.

Actually, this is not a completed queue. Because, you must call shiftAndConsumeTask() function to execute a next task like "non-preemptive multitasking".

* addTask() - Register a new task. If the queue size was empty at registering above, the registered task will be called after 10ms.
* shiftAndConsumeTask() - You must call shiftAndConsumeTask() function to shift the executed task and to execute the next task.

The standard usage is like the following:

```js
let taskQueue = new TaskQueue();
...
chrome.fileSystemProvider.on***Requested.addListener(
  (options, successCallback, errorCallback) => { <- createEventHandler()
    taskQueue.addTask(() => { <- prepare()
      ...
      taskQueue.shiftAndConsumeTask();
    });
  }
);
```

## Other

[/app/manifest.json](https://github.com/yoichiro/chromeos-filesystem-cifs/blob/master/app/manifest.json)

This is a manifest file which is needed for Chrome Apps.
