(function() {

    "use strict";

    // Constructor

    var CifsFS = function() {
        this.cifsClientMap_ = {};
        this.taskQueue_ = {};
        this.opened_files_ = {};
        this.metadataCache_ = {};
        assignEventHandlers.call(this);
    };

    // Public functions

    CifsFS.prototype.getSharedResources = function(options) {
        var cifsClient = new CifsClient(
            this,
            options.serverName,
            options.serverPort,
            options.username,
            options.password
        );
        cifsClient.setup();
        cifsClient.getSharedResources({
            onSuccess: function(result) {
                options.onSuccess(result);
            }.bind(this),
            onError: function(reason) {
                showNotification.call(this, reason);
                options.onError(reason);
            }.bind(this)
        });
    };

    CifsFS.prototype.mount = function(options) {
        var fileSystemId = createFileSystemID.call(
            this, options.serverName, options.serverPort, options.username);
        var cifsClient = new CifsClient(
            this,
            options.serverName, options.serverPort,
            options.username, options.password,
            options.sharedResource);
        this.cifsClientMap_[fileSystemId] = cifsClient;
        // createTaskQueue.call(this, fileSystemId);
        cifsClient.setup();
        // var requestId = new Date().getTime() % 2147483647;
        var requestId = createRequestId.call(this);
        cifsClient.connect({
            requestId: requestId,
            onSuccess: function(result) {
                console.log(result);
                doMount.call(
                    this,
                    cifsClient.getServerName(), cifsClient.getServerPort(),
                    cifsClient.getUsername(), cifsClient.getPassword(),
                    cifsClient.getSharedResource(),
                    function() {
                        options.onSuccess();
                    }.bind(this));
            }.bind(this),
            onError: options.onError
        });
    };

    CifsFS.prototype.resume = function(fileSystemId, onSuccess, onError) {
        console.log("resume - start");
        getMountedCredential.call(this, fileSystemId, function(credential) {
            if (credential) {
                this.mount({
                    serverName: credential.serverName,
                    serverPort: credential.serverPort,
                    username: credential.username,
                    password: credential.password,
                    sharedResource: credential.sharedResource,
                    onSuccess: function() {
                        console.log("Resumed file system: " + fileSystemId);
                        onSuccess();
                    }.bind(this),
                    onError: function(reason) {
                        handleError.call(this, reason, reason, onError);
                    }.bind(this)
                });
            } else {
                onError("Credential[" + fileSystemId + "] not found");
            }
        }.bind(this));
    };

    CifsFS.prototype.onUnmountRequested = function(options, successCallback, errorCallback) {
        console.log("onUnmountRequested");
        console.log(options);
        var cifsClient = getCifsClient.call(this, options.fileSystemId);
        doUnmount.call(this, cifsClient, options.requestId, successCallback);
    };

    CifsFS.prototype.onReadDirectoryRequested = function(options, successCallback, errorCallback) {
        console.log("onReadDirectoryRequested");
        console.log(options);
        var cifsClient = getCifsClient.call(this, options.fileSystemId);
        var requestId = createRequestId.call(this);
        prepare.call(this, cifsClient, requestId, function(closeCallback) {
            cifsClient.readDirectory({
                requestId: requestId,
                path: options.directoryPath,
                onSuccess: function(result) {
                    console.log(result);
                    var metadataCache = getMetadataCache.call(this, options.fileSystemId);
                    metadataCache.put(options.directoryPath, result.metadataList);
                    successCallback(result.metadataList, false);
                    closeCallback();
                }.bind(this),
                onError: function(reason) {
                    handleError.call(this, reason, "FAILED", errorCallback);
                    closeCallback();
                }
            });
        }.bind(this), function(reason) {
            handleError.call(this, reason, "FAILED", errorCallback);
        }.bind(this));
    };

    CifsFS.prototype.onGetMetadataRequested = function(options, successCallback, errorCallback) {
        console.log("onGetMetadataRequested: thumbnail=" + options.thumbnail);
        console.log(options);
        var cifsClient = getCifsClient.call(this, options.fileSystemId);
        var requestId = createRequestId.call(this);
        prepare.call(this, cifsClient, requestId, function(closeCallback) {
            var metadataCache = getMetadataCache.call(this, options.fileSystemId);
            var cache = metadataCache.get(options.entryPath);
            if (cache.directoryExists && cache.fileExists) {
                successCallback(cache.metadata);
                closeCallback();
            } else {
                cifsClient.getMetadata({
                    requestId: requestId,
                    path: options.entryPath,
                    onSuccess: function(result) {
                        console.log(result);
                        successCallback(result.metadata);
                        closeCallback();
                    }.bind(this),
                    onError: function(reason) {
                        console.log(reason);
                        if (reason === "NOT_FOUND") {
                            errorCallback("NOT_FOUND");
                        } else {
                            handleError.call(this, reason, "FAILED", errorCallback);
                        }
                        closeCallback();
                    }.bind(this)
                });
            }
        }.bind(this), function(reason) {
            console.log(reason);
            errorCallback("FAILED");
        }.bind(this));
    };

    CifsFS.prototype.onOpenFileRequested = function(options, successCallback, errorCallback) {
        console.log("onOpenFileRequested");
        console.log(options);
        var cifsClient = getCifsClient.call(this, options.fileSystemId);
        var requestId = createRequestId.call(this);
        prepare.call(this, cifsClient, requestId, function(closeCallback) {
            var openedFiles = getOpenedFiles.call(this, options.fileSystemId);
            openedFiles[options.requestId] = options.filePath;
            successCallback();
            closeCallback();
        }.bind(this), function(reason) {
            handleError.call(this, reason, "FAILED", errorCallback);
        }.bind(this));
    };

    CifsFS.prototype.onReadFileRequested = function(options, successCallback, errorCallback) {
        console.log("onReadFileRequested - start");
        console.log(options);
        var filePath = getOpenedFiles.call(this, options.fileSystemId)[options.openRequestId];
        var cifsClient = getCifsClient.call(this, options.fileSystemId);
        var requestId = createRequestId.call(this);
        prepare.call(this, cifsClient, requestId, function(closeCallback) {
            cifsClient.readFile({
                requestId: requestId,
                path: filePath,
                offset: options.offset,
                length: options.length,
                onSuccess: function(result) {
                    console.log(result);
                    successCallback(result.data, result.hasMore);
                    if (!result.hasMore) {
                        closeCallback();
                    }
                }.bind(this),
                onError: function(reason) {
                    handleError.call(this, reason, "FAILED", errorCallback);
                    closeCallback();
                }
            });
        }.bind(this), function(reason) {
            handleError.call(this, reason, "FAILED", errorCallback);
        }.bind(this));
    };

    CifsFS.prototype.onCloseFileRequested = function(options, successCallback, errorCallback) {
        console.log("onCloseFileRequested");
        var cifsClient = getCifsClient.call(this, options.fileSystemId);
        var requestId = createRequestId.call(this);
        prepare.call(this, cifsClient, requestId, function(closeCallback) {
            var openedFiles = getOpenedFiles.call(this, options.fileSystemId);
            delete openedFiles[options.openRequestId];
            successCallback();
            closeCallback();
        }.bind(this), function(reason) {
            handleError.call(this, reason, "FAILED", errorCallback);
        }.bind(this));
    };

    CifsFS.prototype.onCreateDirectoryRequested = function(options, successCallback, errorCallback) {
        console.log("onCreateDirectoryRequested");
        console.log(options);
        var cifsClient = getCifsClient.call(this, options.fileSystemId);
        var requestId = createRequestId.call(this);
        prepare.call(this, cifsClient, requestId, function(closeCallback) {
            cifsClient.createDirectory({
                requestId: requestId,
                path: options.directoryPath,
                onSuccess: function() {
                    successCallback();
                    closeCallback();
                }.bind(this),
                onError: function(reason) {
                    handleError.call(this, reason, "FAILED", errorCallback);
                    closeCallback();
                }
            });
        }.bind(this), function(reason) {
            handleError.call(this, reason, "FAILED", errorCallback);
        }.bind(this));
    };

    CifsFS.prototype.onDeleteEntryRequested = function(options, successCallback, errorCallback) {
        console.log("onDeleteEntryRequested");
        console.log(options);
        var cifsClient = getCifsClient.call(this, options.fileSystemId);
        var requestId = createRequestId.call(this);
        prepare.call(this, cifsClient, requestId, function(closeCallback) {
            cifsClient.deleteEntry({
                requestId: requestId,
                path: options.entryPath,
                onSuccess: function() {
                    var metadataCache = getMetadataCache.call(this, options.fileSystemId);
                    metadataCache.remove(options.entryPath);
                    successCallback();
                    closeCallback();
                }.bind(this),
                onError: function(reason) {
                    handleError.call(this, reason, "FAILED", errorCallback);
                    closeCallback();
                }
            });
        }.bind(this), function(reason) {
            handleError.call(this, reason, "FAILED", errorCallback);
        }.bind(this));
    };

    CifsFS.prototype.onMoveEntryRequested = function(options, successCallback, errorCallback) {
        console.log("onMoveEntryRequested");
        console.log(options);
        var cifsClient = getCifsClient.call(this, options.fileSystemId);
        var requestId = createRequestId.call(this);
        prepare.call(this, cifsClient, requestId, function(closeCallback) {
            cifsClient.moveEntry({
                requestId: requestId,
                sourcePath: options.sourcePath,
                targetPath: options.targetPath,
                onSuccess: function() {
                    var metadataCache = getMetadataCache.call(this, options.fileSystemId);
                    metadataCache.remove(options.sourcePath);
                    metadataCache.remove(options.targetPath);
                    successCallback();
                    closeCallback();
                }.bind(this),
                onError: function(reason) {
                    handleError.call(this, reason, "FAILED", errorCallback);
                    closeCallback();
                }
            });
        }.bind(this), function(reason) {
            handleError.call(this, reason, "FAILED", errorCallback);
        }.bind(this));
    };

    CifsFS.prototype.onCopyEntryRequested = function(options, successCallback, errorCallback) {
        console.log("onCopyEntryRequested");
        console.log(options);
        var cifsClient = getCifsClient.call(this, options.fileSystemId);
        var requestId = createRequestId.call(this);
        prepare.call(this, cifsClient, requestId, function(closeCallback) {
            cifsClient.copyEntry({
                requestId: requestId,
                sourcePath: options.sourcePath,
                targetPath: options.targetPath,
                onSuccess: function() {
                    successCallback();
                    closeCallback();
                }.bind(this),
                onError: function(reason) {
                    handleError.call(this, reason, "FAILED", errorCallback);
                    closeCallback();
                }
            });
        }.bind(this), function(reason) {
            handleError.call(this, reason, "FAILED", errorCallback);
        }.bind(this));
    };

    CifsFS.prototype.onWriteFileRequested = function(options, successCallback, errorCallback) {
        console.log("onWriteFileRequested");
        console.log(options);
        var filePath = getOpenedFiles.call(this, options.fileSystemId)[options.openRequestId];
        var cifsClient = getCifsClient.call(this, options.fileSystemId);
        var requestId = createRequestId.call(this);
        prepare.call(this, cifsClient, requestId, function(closeCallback) {
            cifsClient.writeFile({
                requestId: requestId,
                path: filePath,
                offset: options.offset,
                data: options.data,
                onSuccess: function() {
                    var metadataCache = getMetadataCache.call(this, options.fileSystemId);
                    metadataCache.remove(filePath);
                    successCallback();
                    closeCallback();
                }.bind(this),
                onError: function(reason) {
                    handleError.call(this, reason, "FAILED", errorCallback);
                    closeCallback();
                }
            });
        }.bind(this), function(reason) {
            handleError.call(this, reason, "FAILED", errorCallback);
        }.bind(this));
    };

    CifsFS.prototype.onTruncateRequested = function(options, successCallback, errorCallback) {
        console.log("onTruncateRequested");
        console.log(options);
        var cifsClient = getCifsClient.call(this, options.fileSystemId);
        var requestId = createRequestId.call(this);
        prepare.call(this, cifsClient, requestId, function(closeCallback) {
            cifsClient.truncate({
                requestId: requestId,
                path: options.filePath,
                length: options.length,
                onSuccess: function() {
                    successCallback(false);
                    closeCallback();
                }.bind(this),
                onError: function(reason) {
                    handleError.call(this, reason, "FAILED", errorCallback);
                    closeCallback();
                }
            });
        }.bind(this), function(reason) {
            handleError.call(this, reason, "FAILED", errorCallback);
        }.bind(this));
    };

    CifsFS.prototype.onCreateFileRequested = function(options, successCallback, errorCallback) {
        console.log("onCreateFileRequested");
        console.log(options);
        var cifsClient = getCifsClient.call(this, options.fileSystemId);
        var requestId = createRequestId.call(this);
        prepare.call(this, cifsClient, requestId, function(closeCallback) {
            cifsClient.createFile({
                requestId: requestId,
                path: options.filePath,
                onSuccess: function() {
                    var metadataCache = getMetadataCache.call(this, options.fileSystemId);
                    metadataCache.remove(options.filePath);
                    successCallback();
                    closeCallback();
                }.bind(this),
                onError: function(reason) {
                    handleError.call(this, reason, "FAILED", errorCallback);
                    closeCallback();
                }
            });
        }.bind(this), function(reason) {
            handleError.call(this, reason, "FAILED", errorCallback);
        }.bind(this));
    };

    CifsFS.prototype.checkAlreadyMounted = function(serverName, serverPort, username, callback) {
        var fileSystemId = createFileSystemID.call(this, serverName, serverPort, username);
        chrome.fileSystemProvider.getAll(function(fileSystems) {
            for (var i = 0; i < fileSystems.length; i++) {
                if (fileSystems[i].fileSystemId === fileSystemId) {
                    callback(true);
                    return;
                }
            }
            callback(false);
        }.bind(this));
    };

    // Private functions

    var doMount = function(serverName, serverPort, username, password, sharedResource, callback) {
        this.checkAlreadyMounted(serverName, serverPort, username, function(exists) {
            if (!exists) {
                var fileSystemId = createFileSystemID.call(this, serverName, serverPort, username);
                var displayName = serverName;
                if (Number(serverPort) !== 445) {
                    displayName += ":" + serverPort;
                }
                displayName += " (" + username + ")";
                chrome.fileSystemProvider.mount({
                    fileSystemId: fileSystemId,
                    displayName: displayName,
                    writable: true
                }, function() {
                    registerMountedCredential(
                        serverName, serverPort, username, password, sharedResource,
                        function() {
                            callback();
                        }.bind(this));
                }.bind(this));
            } else {
                callback();
            }
        }.bind(this));
    };

    var doUnmount = function(cifsClient, requestId, successCallback) {
        console.log("doUnmount");
        _doUnmount.call(
            this,
            cifsClient.getServerName(),
            cifsClient.getServerPort(),
            cifsClient.getUsername(),
            function() {
                successCallback();
            }.bind(this));
    };

    var _doUnmount = function(serverName, serverPort, username, successCallback) {
        console.log("_doUnmount");
        unregisterMountedCredential.call(
            this, serverName, serverPort, username,
            function() {
                var fileSystemId = createFileSystemID.call(this, serverName, serverPort, username);
                console.log(fileSystemId);
                chrome.fileSystemProvider.unmount({
                    fileSystemId: fileSystemId
                }, function() {
                    var deleteTemporaryInfo = function() {
                        delete this.cifsClientMap_[fileSystemId];
                        deleteTaskQueue.call(this, fileSystemId);
                        deleteMetadataCache.call(this, fileSystemId);
                        successCallback();
                    }.bind(this);
                    var client = getCifsClient.call(this, fileSystemId);
                    client.close({
                        onSuccess: function() {
                            deleteTemporaryInfo();
                        }.bind(this),
                        onError: function(error) {
                            deleteTemporaryInfo();
                        }.bind(this)
                    });
                }.bind(this));
            }.bind(this));
    };

    var registerMountedCredential = function(
            serverName, serverPort, username, password, sharedResource, callback) {
        var fileSystemId = createFileSystemID.call(this, serverName, serverPort, username);
        chrome.storage.local.get("mountedCredentials", function(items) {
            var mountedCredentials = items.mountedCredentials || {};
            mountedCredentials[fileSystemId] = {
                serverName: serverName,
                serverPort: serverPort,
                username: username,
                password: password,
                sharedResource: sharedResource
            };
            chrome.storage.local.set({
                mountedCredentials: mountedCredentials
            }, function() {
                callback();
            }.bind(this));
        }.bind(this));
    };

    var unregisterMountedCredential = function(serverName, serverPort, username, callback) {
        var fileSystemId = createFileSystemID.call(this, serverName, serverPort, username);
        chrome.storage.local.get("mountedCredentials", function(items) {
            var mountedCredentials = items.mountedCredentials || {};
            delete mountedCredentials[fileSystemId];
            chrome.storage.local.set({
                mountedCredentials: mountedCredentials
            }, function() {
                callback();
            }.bind(this));
        }.bind(this));
    };

    var getMountedCredential = function(fileSystemId, callback) {
        chrome.storage.local.get("mountedCredentials", function(items) {
            var mountedCredentials = items.mountedCredentials || {};
            var credential = mountedCredentials[fileSystemId];
            callback(credential);
        }.bind(this));
    };

    var createFileSystemID = function(serverName, serverPort, username) {
        var id = "cifsfs://" + serverName + ":" + serverPort + "/" + username;
        return id;
    };

    var createEventHandler = function(callback) {
        return function(options, successCallback, errorCallback) {
            var fileSystemId = options.fileSystemId;
            addTaskQueue.call(this, fileSystemId, function() {
                var cifsClient = getCifsClient.call(this, fileSystemId);
                if (!cifsClient) {
                    this.resume(fileSystemId, function() {
                        callback(options, successCallback, errorCallback);
                    }.bind(this), function(reason) {
                        console.log("resume failed: " + reason);
                        showNotification.call(this, "Resuming connection failed. Unmount.");
                        getMountedCredential.call(this, fileSystemId, function(credential) {
                            if (credential) {
                                _doUnmount.call(
                                    this,
                                    credential.serverName,
                                    credential.serverPort,
                                    credential.username,
                                    function() {
                                        errorCallback("FAILED");
                                    }.bind(this));
                            } else {
                                console.log("Credential for [" + fileSystemId + "] not found.");
                                errorCallback("FAILED");
                            }
                        }.bind(this));
                    }.bind(this));
                } else {
                    callback(options, successCallback, errorCallback);
                }
            }.bind(this));
        }.bind(this);
    };

    var assignEventHandlers = function() {
        chrome.fileSystemProvider.onUnmountRequested.addListener(
            function(options, successCallback, errorCallback) { // Unmount immediately
                var fileSystemId = options.fileSystemId;
                var cifsClient = getCifsClient.call(this, fileSystemId);
                if (!cifsClient) {
                    this.resume(fileSystemId, function() {
                        this.onUnmountRequested(options, successCallback, errorCallback);
                    }.bind(this), function(reason) {
                        console.log("resume failed: " + reason);
                        showNotification.call(this, "resume failed: " + reason);
                        errorCallback("FAILED");
                    }.bind(this));
                } else {
                    this.onUnmountRequested(options, successCallback, errorCallback);
                }
            }.bind(this));
        chrome.fileSystemProvider.onReadDirectoryRequested.addListener(
            createEventHandler.call(this, function(options, successCallback, errorCallback) {
                this.onReadDirectoryRequested(options, successCallback, errorCallback);
            }.bind(this)));
        chrome.fileSystemProvider.onGetMetadataRequested.addListener(
            function(options, successCallback, errorCallback) {
                var handler = createEventHandler.call(this, function(options, successCallback, errorCallback) {
                    this.onGetMetadataRequested(options, successCallback, errorCallback);
                }.bind(this));
                var fileSystemId = options.fileSystemId;
                var cifsClient = getCifsClient.call(this, fileSystemId);
                if (cifsClient) {
                    var metadataCache = getMetadataCache.call(this, fileSystemId);
                    var cache = metadataCache.get(options.entryPath);
                    if (cache.directoryExists && cache.fileExists) {
                        successCallback(cache.metadata);
                    } else {
                        handler(options, successCallback, errorCallback);
                    }
                } else {
                    handler(options, successCallback, errorCallback);
                }
            }.bind(this));
        chrome.fileSystemProvider.onOpenFileRequested.addListener(
            createEventHandler.call(this, function(options, successCallback, errorCallback) {
                this.onOpenFileRequested(options, successCallback, errorCallback);
            }.bind(this)));
        chrome.fileSystemProvider.onReadFileRequested.addListener(
            createEventHandler.call(this, function(options, successCallback, errorCallback) {
                this.onReadFileRequested(options, successCallback, errorCallback);
            }.bind(this)));
        chrome.fileSystemProvider.onCloseFileRequested.addListener(
            createEventHandler.call(this, function(options, successCallback, errorCallback) {
                this.onCloseFileRequested(options, successCallback, errorCallback);
            }.bind(this)));
        chrome.fileSystemProvider.onCreateDirectoryRequested.addListener(
            createEventHandler.call(this, function(options, successCallback, errorCallback) {
                this.onCreateDirectoryRequested(options, successCallback, errorCallback);
            }.bind(this)));
        chrome.fileSystemProvider.onDeleteEntryRequested.addListener(
            createEventHandler.call(this, function(options, successCallback, errorCallback) {
                this.onDeleteEntryRequested(options, successCallback, errorCallback);
            }.bind(this)));
        chrome.fileSystemProvider.onMoveEntryRequested.addListener(
            createEventHandler.call(this, function(options, successCallback, errorCallback) {
                this.onMoveEntryRequested(options, successCallback, errorCallback);
            }.bind(this)));
        chrome.fileSystemProvider.onCopyEntryRequested.addListener(
            createEventHandler.call(this, function(options, successCallback, errorCallback) {
                this.onCopyEntryRequested(options, successCallback, errorCallback);
            }.bind(this)));
        chrome.fileSystemProvider.onWriteFileRequested.addListener(
            createEventHandler.call(this, function(options, successCallback, errorCallback) {
                this.onWriteFileRequested(options, successCallback, errorCallback);
            }.bind(this)));
        chrome.fileSystemProvider.onTruncateRequested.addListener(
            createEventHandler.call(this, function(options, successCallback, errorCallback) {
                this.onTruncateRequested(options, successCallback, errorCallback);
            }.bind(this)));
        chrome.fileSystemProvider.onCreateFileRequested.addListener(
            createEventHandler.call(this, function(options, successCallback, errorCallback) {
                this.onCreateFileRequested(options, successCallback, errorCallback);
            }.bind(this)));
    };

    var getCifsClient = function(fileSystemID) {
        var cifsClient = this.cifsClientMap_[fileSystemID];
        return cifsClient;
    };

    var prepare = function(cifsClient, requestId, onSuccess, onError) {
        var closeCallback = (function(self, cifsClient) {
            return function() {
                if (chrome.runtime.lastError) {
                    console.log(chrome.runtime.lastError);
                }
                var fileSystemId = createFileSystemID.call(self,
                    cifsClient.getServerName(), cifsClient.getServerPort(), cifsClient.getUsername());
                shiftAndConsumeQueue.call(self, fileSystemId);
            }.bind(self);
        })(this, cifsClient);
        onSuccess(closeCallback);
    };

    var getTaskQueue = function(fileSystemId) {
        var taskQueue = this.taskQueue_[fileSystemId];
        if (!taskQueue) {
            taskQueue = new TaskQueue();
            this.taskQueue_[fileSystemId] = taskQueue;
            console.log("getTaskQueue: Created. " + fileSystemId);
        }
        return taskQueue;
    };

    var deleteTaskQueue = function(fileSystemId) {
        console.log("deleteTaskQueue: " + fileSystemId);
        delete this.taskQueue_[fileSystemId];
    };

    var addTaskQueue = function(fileSystemId, task) {
        var taskQueue = getTaskQueue.call(this, fileSystemId);
        taskQueue.addTask(task);
    };

    var shiftAndConsumeQueue = function(fileSystemId) {
        var taskQueue = getTaskQueue.call(this, fileSystemId);
        taskQueue.shiftAndConsumeTask();
    };

    var getOpenedFiles = function(fileSystemId) {
        var openedFiles = this.opened_files_[fileSystemId];
        if (!openedFiles) {
            openedFiles = {};
            this.opened_files_[fileSystemId] = openedFiles;
        }
        return openedFiles;
    };

    var createRequestId = function() {
        // var requestId = options.requestId;
        var requestId = 0;
        return requestId;
    };

    var getMetadataCache = function(fileSystemId) {
        var metadataCache = this.metadataCache_[fileSystemId];
        if (!metadataCache) {
            metadataCache = new MetadataCache();
            this.metadataCache_[fileSystemId] = metadataCache;
            console.log("getMetadataCache: Created. " + fileSystemId);
        }
        return metadataCache;
    };

    var deleteMetadataCache = function(fileSystemId) {
        console.log("deleteMetadataCache: " + fileSystemId);
        delete this.metadataCache_[fileSystemId];
    };

    var handleError = function(reason, errorCode, onError) {
        console.log(reason);
        showNotification.call(this, reason);
        onError(errorCode);
    };

    var showNotification = function(message) {
        chrome.notifications.create("", {
            type: "basic",
            title: "SMB/CIFS File System",
            message: message,
            iconUrl: "/icons/48.png"
        }, function(notificationId) {
        }.bind(this));
    };

    // Export

    window.CifsFS = CifsFS;

})();
