(function(Constants) {

    "use strict";

    // Constructor

    var Session = function() {
        this.serverName_ = null;
        this.maxBufferSize_ = null;
        this.userId_ = null;
        this.treeId_ = null;
        this.processId_ = (new Date()).getTime() % 0xffff;
        this.protocolVersion_ = Constants.PROTOCOL_VERSION_SMB1;
        this.clientGuid_ = null;
    };

    // Public functions

    Session.prototype.setServerName = function(serverName) {
        this.serverName_ = serverName;
    };

    Session.prototype.getServerName = function() {
        return this.serverName_;
    };

    Session.prototype.setMaxBufferSize = function(maxBufferSize) {
        this.maxBufferSize_ = maxBufferSize;
    };

    Session.prototype.getMaxBufferSize = function() {
        return this.maxBufferSize_;
    };

    Session.prototype.setUserId = function(userId) {
        this.userId_ = userId;
    };

    Session.prototype.getUserId = function() {
        return this.userId_;
    };

    Session.prototype.setTreeId = function(treeId) {
        this.treeId_ = treeId;
    };

    Session.prototype.getTreeId = function() {
        return this.treeId_;
    };

    Session.prototype.setProcessId = function(processId) {
        this.processId_ = processId;
    };

    Session.prototype.getProcessId = function() {
        return this.processId_;
    };

    Session.prototype.changeProcessId = function() {
        var current = this.processId_;
        var newProcessId = current;
        while (newProcessId === current) {
            newProcessId = (new Date()).getTime() % 0xffff;
        }
        this.processId_ = newProcessId;
    };

    Session.prototype.setProtocolVersion = function(protocolVersion) {
        this.protocolVersion_ = protocolVersion;
    };

    Session.prototype.getProtocolVersion = function() {
        return this.protocolVersion_;
    };

    Session.prototype.setClientGuid = function(clientGuid) {
        this.clientGuid_ = clientGuid;
    };

    Session.prototype.getClientGuid = function() {
        return this.clientGuid_;
    };

    // Export

    SmbClient.Session = Session;

})(SmbClient.Constants);
