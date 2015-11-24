(function(Debug) {

    "use strict";

    var mdnsResult = [];

    var cifs_fs_ = new CifsFS();

    var setDebugLevel = function() {
        chrome.storage.local.get("settings", function(items) {
            var settings = items.settings;
            var debugLevel = settings.debugLevel;
            if (typeof debugLevel === "undefined") {
                debugLevel = 1;
            }
            Debug.Level = debugLevel;
        });
    };

    var openWindow = function() {
        chrome.app.window.create("window.html", {
        //chrome.app.window.create("index.html", {
            outerBounds: {
                width: 800,
                height: 480
            },
            resizable: false
        });
    };

    var assignEventListeners = function() {
        chrome.app.runtime.onLaunched.addListener(openWindow);

        if (chrome.fileSystemProvider.onMountRequested) {
            chrome.fileSystemProvider.onMountRequested.addListener(openWindow);
        }

        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            Debug.trace(request);
            switch(request.type) {
            case "getSharedResources":
                getSharedResources(request, sendResponse);
                break;
            case "mount":
                doMount(request, sendResponse);
                break;
            case "refreshDebugLevel":
                setDebugLevel();
                break;
            case "lookupServiceList":
                lookupServiceList(request, sendResponse);
                break;
            default:
                var message;
                if (request.type) {
                    message = "Invalid request type: " + request.type + ".";
                } else {
                    message = "No request type provided.";
                }
                sendResponse({
                    type: "error",
                    success: false,
                    message: message
                });
                break;
            }
            return true;
        });

        chrome.mdns.onServiceList.addListener(function(result) {
            console.log("Looked up with chrome.mdns: ", result);
            mdnsResult = result;
        }, {
            serviceType: "_smb._tcp.local"
        });
    };

    var lookupServiceList = function(request, sendResponse) {
        sendResponse({
            type: "serviceList",
            serviceList: mdnsResult
        });
    };

    var getSharedResources = function(request, sendResponse) {
        cifs_fs_.getSharedResources({
            serverName: request.serverName,
            serverPort: request.serverPort,
            username: request.username,
            password: request.password,
            domainName: request.domainName,
            onSuccess: function(result) {
                var sharedResources = [];
                for (var i = 0; i < result.length; i++) {
                    if (result[i].type === 0) {
                        sharedResources.push(result[i]);
                    }
                }
                sendResponse({
                    type: "sharedResources",
                    sharedResources: sharedResources
                });
            }.bind(this),
            onError: function(error) {
                sendResponse({
                    type: "error",
                    success: false,
                    message: error
                });
            }.bind(this)
        });
    };

    var doMount = function(request, sendResponse) {
        cifs_fs_.checkAlreadyMounted(request.serverName, request.serverPort,request.username, request.domainName, request.sharedResource, function(exists) {
            if (exists) {
                sendResponse({
                    type: "error",
                    error: "Already mounted"
                });
            } else {
                var rootDirectory = normalizeRootDirectory(request.rootDirectory);
                var options = {
                    serverName: request.serverName,
                    serverPort: request.serverPort,
                    username: request.username,
                    password: request.password,
                    domainName: request.domainName,
                    sharedResource: request.sharedResource,
                    rootDirectory: rootDirectory,
                    onSuccess: function(algorithm, fingerprint, requestId, fileSystemId) {
                        sendResponse({
                            type: "mount",
                            success: true
                        });
                    },
                    onError: function(reason) {
                        sendResponse({
                            type: "mount",
                            success: false,
                            error: reason
                        });
                    }
                };
                cifs_fs_.mount(options);
            }
        });
    };

    var normalizeRootDirectory = function(rootDirectory) {
        var work = rootDirectory;
        if (!work) {
            return "";
        }
        if (work.charAt(0) !== "/") {
            work = "/" + work;
        }
        if (work.substring(work.length - 1) === "/") {
            work = work.substring(0, work.length - 1);
        }
        console.log(work);
        return work;
    };

    setDebugLevel();
    assignEventListeners();

})(SmbClient.Debug);
