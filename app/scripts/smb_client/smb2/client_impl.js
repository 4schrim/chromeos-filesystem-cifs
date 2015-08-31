(function(Smb2, Constants, Debug, Protocol, Packet) {
    "use strict";
    
    // Constructor
    
    var ClientImpl = function(client) {
        this.protocol_ = new Protocol();
      
        this.client_ = client;
        this.comm_ = client.getCommunication();
    };
    
    // Public functions
    
    ClientImpl.prototype.handleNegotiateResponse = function(packet, onSuccess, onError) {
        var session = this.client_.getSession();
        var header = packet.getHeader();
        if (checkError.call(this, header, onError)) {
            var negotiateResponse =
                    this.protocol_.parseNegotiateResponse(packet);
            if (negotiateResponse.getDialectRevision() !== Constants.DIALECT_SMB_2_002_REVISION) {
                onError("Supported dialect not found");
            } else {
                session.setMaxBufferSize(
                    negotiateResponse.getMaxReadSize());
                onSuccess(header, negotiateResponse);
            }
        }
    };
    
    ClientImpl.prototype.sessionSetup = function(negotiateResponse, userName, password, domainName, onSuccess, onError) {
        sendType1Message.call(this, negotiateResponse, function(
            header, sessionSetupResponse) {

            var type2Message = sessionSetupResponse.getType2Message();
            Debug.outputType2MessageFlags(type2Message);

            sendType3Message.call(this, userName, password, domainName, negotiateResponse, sessionSetupResponse, function() {
                onSuccess();
            }.bind(this), function(error) {
                onError(error);
            }.bind(this));
        }.bind(this), function(error) {
            onError(error);
        }.bind(this));
    };

    /*jslint bitwise: true */
    ClientImpl.prototype.getSharedResourceList = function(onSuccess, onError) {
        var errorHandler = function(error) {
            console.log(error);
            onError(error);
        }.bind(this);

        connectTree.call(this, "IPC$", function(
            treeConnectResponseHeader, treeConnectResponse) {
            Debug.log(treeConnectResponseHeader);
            Debug.log(treeConnectResponse);
            var options = {
                desiredAccess:
                    Constants.GENERIC_WRITE | Constants.GENERIC_READ,
                fileAttributes:
                    Constants.SMB2_FILE_ATTRIBUTE_NORMAL,
                shareAccess:
                    Constants.FILE_SHARE_READ |
                    Constants.FILE_SHARE_WRITE,
                createDisposition: Constants.FILE_OPEN,
                name: "\\srvsvc",
                createContexts: [
                    this.protocol_.createCreateContext(0, Constants.SMB2_CREATE_QUERY_MAXIMAL_ACCESS_REQUEST, null)
                ]
            };
            create.call(this, options, function(
                createResponseHeader, createResponse) {
                Debug.log(createResponseHeader);
                Debug.log(createResponse);
                var fid = createResponse.getFileId();
                dceRpcBind.call(this, fid, function(
                    dceRpcBindResponseHeader, dceRpcBindAck) {
                    Debug.log(dceRpcBindResponseHeader);
                    Debug.log(dceRpcBindAck);
                    netShareEnumAll.call(this, fid, function(
                        dceRpcNetShareEnumAllResponseHeader, dceRpcNetShareEnumAllResponse) {
                        Debug.log(dceRpcNetShareEnumAllResponseHeader);
                        Debug.log(dceRpcNetShareEnumAllResponse);
                        close.call(this, fid, function(closeResponseHeader) {
                            Debug.log(closeResponseHeader);
                            onSuccess(dceRpcNetShareEnumAllResponse.getNetShareEnums());
                        }.bind(this), errorHandler);
                    }.bind(this), errorHandler);
                }.bind(this), errorHandler);
            }.bind(this), errorHandler);
        }.bind(this), errorHandler);
    };
    
    ClientImpl.prototype.logout = function(onSuccess, onError) {
        var session = this.client_.getSession();
        
        var errorHandler = function(error) {
            onError(error);
        }.bind(this);

        var logoffAndDisconnect = function() {
            logoff.call(this, function() {
                onSuccess();
            }.bind(this), errorHandler);
        }.bind(this);

        if (session.getTreeId()) {
            disconnectTree.call(this, logoffAndDisconnect, errorHandler);
        } else {
            logoffAndDisconnect();
        }
    };
    
    ClientImpl.prototype.connectSharedResource = function(path, onSuccess, onError) {
        connectTree.call(this, path/*.toUpperCase()*/, function(
            treeConnectResponseHeader, treeConnectResponse) {
            Debug.log(treeConnectResponseHeader);
            Debug.log(treeConnectResponse);
            onSuccess();
        }.bind(this), function(error) {
            onError(error);
        }.bind(this));
    };
    
    ClientImpl.prototype.getMetadata = function(fileName, onSuccess, onError) {
        var errorHandler = function(error) {
            onError(error);
        }.bind(this);

        var options = {
            desiredAccess:
                Constants.FILE_READ_ATTRIBUTES | Constants.SYNCHRONIZE,
            fileAttributes:
                Constants.SMB2_FILE_ATTRIBUTE_NORMAL,
            shareAccess:
                Constants.FILE_SHARE_READ |
                Constants.FILE_SHARE_WRITE |
                Constants.FILE_SHARE_DELETE,
            createDisposition: Constants.FILE_OPEN,
            name: fileName,
            createContexts: [
                this.protocol_.createCreateContext(0, Constants.SMB2_CREATE_QUERY_MAXIMAL_ACCESS_REQUEST, null)
            ]
        };
        create.call(this, options, function(
            createResponseHeader, createResponse) {
            Debug.log(createResponseHeader);
            Debug.log(createResponse);
            var fileId = createResponse.getFileId();
            queryInfo.call(this, fileId, function(
                queryInfoResponseHeader, queryInfoResponse) {
                Debug.log(queryInfoResponseHeader);
                Debug.log(queryInfoResponse);
                close.call(this, fileId, function(closeResponseHeader) {
                    Debug.log(closeResponseHeader);
                    onSuccess(queryInfoResponse.getFile());
                }.bind(this), errorHandler);
            }.bind(this), errorHandler);
        }.bind(this), errorHandler);
    };
    
    ClientImpl.prototype.readDirectory = function(directoryName, onSuccess, onError) {
        var errorHandler = function(error) {
            onError(error);
        }.bind(this);
        
        var trimFirstDelimiter = function(path) {
            if (path && path.charAt(0) === '\\') {
                return path.substring(1);
            } else {
                return path;
            }
        };

        var options = {
            desiredAccess:
                Constants.FILE_READ_DATA | Constants.FILE_READ_ATTRIBUTES | Constants.SYNCHRONIZE,
            fileAttributes:
                Constants.SMB2_FILE_ATTRIBUTE_DIRECTORY,
            shareAccess:
                Constants.FILE_SHARE_READ |
                Constants.FILE_SHARE_WRITE |
                Constants.FILE_SHARE_DELETE,
            createDisposition: Constants.FILE_OPEN,
            createOptions: Constants.FILE_DIRECTORY_FILE,
            name: trimFirstDelimiter(directoryName),
            createContexts: [
                this.protocol_.createCreateContext(0, Constants.SMB2_CREATE_QUERY_MAXIMAL_ACCESS_REQUEST, null)
            ]
        };
        create.call(this, options, function(
            createResponseHeader, createResponse) {
            Debug.log(createResponseHeader);
            Debug.log(createResponse);
            var fileId = createResponse.getFileId();
            var files = [];
            queryDirectoryInfo.call(this, fileId, files, Constants.SMB2_RESTART_SCANS, function() {
                close.call(this, fileId, function(closeResponseHeader) {
                    Debug.log(closeResponseHeader);
                    var result = [];
                    for (var i = 0; i < files.length; i++) {
                        if ((files[i].getFileName() !== ".") && (files[i].getFileName() !== "..")) {
                            files[i].setFullFileName(directoryName + "\\" + files[i].getFileName());
                            result.push(files[i]);
                        }
                    }
                    onSuccess(result);
                }.bind(this), errorHandler);
            }.bind(this), errorHandler);
        }.bind(this), errorHandler);
    };
    
    // Private functions
    
    var checkError = function(header, onError, expected) {
        var errorCode = header.getStatus();
        if (expected) {
            if (errorCode === expected) {
                return true;
            } else {
                onError(Number(errorCode).toString(16) + ": " + Debug.getNtStatusMessage(errorCode));
                return false;
            }
        } else {
            if (errorCode === Constants.NT_STATUS_OK) {
                return true;
            } else if (errorCode === Constants.STATUS_BUFFER_OVERFLOW) {
                // Normal for DCERPC named pipes
                Debug.info("0x80000005: STATUS_BUFFER_OVERFLOW: Normal for DCERPC named pipes. Ignore.");
                return true;
            } else {
                onError(Number(errorCode).toString(16) + ": " + Debug.getNtStatusMessage(errorCode));
                return false;
            }
        }
    };
    
    var sendType1Message = function(negotiateResponse, onSuccess, onError) {
        var session = this.client_.getSession();
        var sessionSetupRequestPacket =
                this.protocol_.createSessionSetupRequestType1Packet(
                    session, negotiateResponse);
        Debug.log(sessionSetupRequestPacket);
        this.comm_.writePacket(sessionSetupRequestPacket, function() {
            this.comm_.readPacket(function(packet) {
                var header = packet.getHeader();
                Debug.log(header);
                if (checkError.call(this, header, onError,
                                    Constants.NT_STATUS_MORE_PROCESSING_REQUIRED)) {
                    var sessionSetupResponse =
                            this.protocol_.parseSessionSetupResponse(packet);
                    session.setUserId(header.getSessionId());
                    onSuccess(header, sessionSetupResponse);
                }
            }.bind(this), function(error) {
                onError(error);
            }.bind(this));
        }.bind(this), function(error) {
            onError(error);
        }.bind(this));
    };

    var sendType3Message = function(userName, password, domainName, negotiateResponse, sessionSetupResponse, onSuccess, onError) {
        var session = this.client_.getSession();
        var sessionSetupRequestPacket =
                this.protocol_.createSessionSetupRequestType3Packet(
                    session, userName, password, domainName, negotiateResponse,
                    sessionSetupResponse.getType2Message());
        Debug.log(sessionSetupRequestPacket);
        this.comm_.writePacket(sessionSetupRequestPacket, function() {
            this.comm_.readPacket(function(packet) {
                var header = packet.getHeader();
                if (checkError.call(this, header, onError)) {
                    onSuccess();
                }
            }.bind(this), function(error) {
                onError(error);
            }.bind(this));
        }.bind(this), function(error) {
            onError(error);
        }.bind(this));
    };
    
    var connectTree = function(name, onSuccess, onError) {
        var session = this.client_.getSession();
        var treeConnectRequestPacket =
                this.protocol_.createTreeConnectRequestPacket(
                    session, name);
        Debug.log(treeConnectRequestPacket);
        this.comm_.writePacket(treeConnectRequestPacket, function() {
            this.comm_.readPacket(function(packet) {
                var header = packet.getHeader();
                if (checkError.call(this, header, onError)) {
                    session.setTreeId(header.getTreeId());
                    var treeConnectResponse =
                            this.protocol_.parseTreeConnectResponse(packet);
                    onSuccess(header, treeConnectResponse);
                }
            }.bind(this), function(error) {
                onError(error);
            }.bind(this));
        }.bind(this), function(error) {
            onError(error);
        }.bind(this));
    };

    var create = function(options, onSuccess, onError) {
        var session = this.client_.getSession();
        var createRequestPacket = this.protocol_.createCreateRequestPacket(
            session, options);
        Debug.log(createRequestPacket);
        this.comm_.writePacket(createRequestPacket, function() {
            this.comm_.readPacket(function(packet) {
                var header = packet.getHeader();
                if (checkError.call(this, header, onError)) {
                    var createResponse =
                            this.protocol_.parseCreateResponse(packet);
                    onSuccess(header, createResponse);
                }
            }.bind(this), function(error) {
                onError(error);
            }.bind(this));
        }.bind(this), function(error) {
            onError(error);
        }.bind(this));
    };

    var dceRpcBind = function(fid, onSuccess, onError) {
        var session = this.client_.getSession();
        var dceRpcBindRequestPacket = this.protocol_.createDceRpcBindRequestPacket(session, fid);
        Debug.log(dceRpcBindRequestPacket);
        this.comm_.writePacket(dceRpcBindRequestPacket, function() {
            this.comm_.readPacket(function(packet) {
                var header = packet.getHeader();
                if (checkError.call(this, header, onError)) {
                    var dceRpcBindAck = this.protocol_.parseDceRpcBindAckPacket(packet);
                    onSuccess(header, dceRpcBindAck);
                }
            }.bind(this), function(error) {
                onError(error);
            }.bind(this));
        }.bind(this), function(error) {
            onError(error);
        }.bind(this));
    };

    var netShareEnumAll = function(fid, onSuccess, onError) {
        var session = this.client_.getSession();
        var dceRpcNetShareEnumAllRequestPacket =
                this.protocol_.createDceRpcNetShareEnumAllRequestPacket(
                    session, fid);
        Debug.log(dceRpcNetShareEnumAllRequestPacket);
        this.comm_.writePacket(dceRpcNetShareEnumAllRequestPacket, function() {
            this.comm_.readPacket(function(packet) {
                var header = packet.getHeader();
                Debug.log(header);
                if (header.getStatus() === Constants.STATUS_BUFFER_OVERFLOW) {
                    // TODO Support STATUS_BUFFER_OVERFLOW
                    /*
                    read.call(this, fid, 0, Constants.TRANSACTION_MAX_APPEND_READ_SIZE, function(buffer) {
                        var newBuffer = this.binaryUtils_.concatBuffers([packet.getData(), buffer]);
                        var dceRpcNetShareEnumAllResponse =
                                this.protocol_.parseDceRpcNetShareEnumAllResponsePacket(
                                    new Packet(newBuffer), buffer.byteLength);
                        onSuccess(header, dceRpcNetShareEnumAllResponse);
                    }.bind(this), function(error) {
                        onError(error);
                    }.bind(this));
                    */
                } else {
                    if (checkError.call(this, header, onError)) {
                        var dceRpcNetShareEnumAllResponse =
                                this.protocol_.parseDceRpcNetShareEnumAllResponsePacket(packet, 0);
                        onSuccess(header, dceRpcNetShareEnumAllResponse);
                    }
                }
            }.bind(this), function(error) {
                onError(error);
            }.bind(this));
        }.bind(this), function(error) {
            onError(error);
        }.bind(this));
    };

    var close = function(fid, onSuccess, onError) {
        var session = this.client_.getSession();
        var closeRequestPacket = this.protocol_.createCloseRequestPacket(
            session, fid);
        Debug.log(closeRequestPacket);
        this.comm_.writePacket(closeRequestPacket, function() {
            this.comm_.readPacket(function(packet) {
                var header = packet.getHeader();
                if (checkError.call(this, header, onError)) {
                    onSuccess(header);
                }
            }.bind(this), function(error) {
                onError(error);
            }.bind(this));
        }.bind(this), function(error) {
            onError(error);
        }.bind(this));
    };

    var disconnectTree = function(onSuccess, onError) {
        var session = this.client_.getSession();
        var treeDisconnectRequestPacket = this.protocol_.createTreeDisconnectRequestPacket(session);
        Debug.log(treeDisconnectRequestPacket);
        this.comm_.writePacket(treeDisconnectRequestPacket, function() {
            this.comm_.readPacket(function(packet) {
                var header = packet.getHeader();
                if (checkError.call(this, header, onError)) {
                    session.setTreeId(null);
                    onSuccess(header);
                }
            }.bind(this), function(error) {
                onError(error);
            }.bind(this));
        }.bind(this), function(error) {
            onError(error);
        }.bind(this));
    };

    var logoff = function(onSuccess, onError) {
        var session = this.client_.getSession();
        var logoffRequestPacket = this.protocol_.createLogoffRequestPacket(session);
        this.comm_.writePacket(logoffRequestPacket, function() {
            this.comm_.readPacket(function(packet) {
                var header = packet.getHeader();
                Debug.log(header);
                if (checkError.call(this, header, onError)) {
                    onSuccess(header);
                }
            }.bind(this), function(error) {
                onError(error);
            }.bind(this));
        }.bind(this), function(error) {
            onError(error);
        }.bind(this));
    };
    
    var queryInfo = function(fileId, onSuccess, onError) {
        var session = this.client_.getSession();
        var queryInfoRequestPacket = this.protocol_.createQueryInfoRequestPacket(session, fileId);
        Debug.log(queryInfoRequestPacket);
        this.comm_.writePacket(queryInfoRequestPacket, function() {
            this.comm_.readPacket(function(packet) {
                var header = packet.getHeader();
                if (checkError.call(this, header, onError)) {
                    var queryInfoResponse =
                            this.protocol_.parseQueryInfoResponsePacket(packet);
                    var file = queryInfoResponse.getFile();
                    file.setFileName(getNameFromPath.call(this, file.getFullFileName()));
                    onSuccess(header, queryInfoResponse);
                }
            }.bind(this), function(error) {
                onError(error);
            }.bind(this));
        }.bind(this), function(error) {
            onError(error);
        }.bind(this));
    };
    
    var queryDirectoryInfo = function(fileId, files, flags, onSuccess, onError) {
        var session = this.client_.getSession();
        var queryDirectoryInfoRequestPacket = this.protocol_.createQueryDirectoryInfoRequestPacket(
            session, fileId, flags);
        this.comm_.writePacket(queryDirectoryInfoRequestPacket, function() {
            this.comm_.readPacket(function(packet) {
                var header = packet.getHeader();
                if (header.getStatus() === Constants.SMB2_STATUS_NO_MORE_FILES) {
                    onSuccess();
                } else {
                    if (checkError.call(this, header, onError)) {
                        var queryDirectoryInfoResponse =
                                this.protocol_.parseQueryDirectoryInfoResponsePacket(packet);
                        for (var i = 0; i < queryDirectoryInfoResponse.getFiles().length; i++) {
                            files.push(queryDirectoryInfoResponse.getFiles()[i]);
                        }
                        Debug.log(header);
                        Debug.log(queryDirectoryInfoResponse);
                        queryDirectoryInfo.call(this, fileId, files, 0, onSuccess, onError);
                    }
                }
            }.bind(this), function(error) {
                onError(error);
            }.bind(this));
        }.bind(this), function(error) {
            onError(error);
        }.bind(this));
    };

    var getNameFromPath = function(path) {
        var names = path.split("\\");
        var name = names[names.length - 1];
        return name;
    };

    // Export
    
    Smb2.ClientImpl = ClientImpl;
    
    
})(SmbClient.Smb2,
   SmbClient.Constants,
   SmbClient.Debug,
   SmbClient.Smb2.Protocol,
   SmbClient.Packet);
