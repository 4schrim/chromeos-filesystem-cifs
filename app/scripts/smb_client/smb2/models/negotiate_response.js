(function(Models, Types, Constants, Debug, Asn1Obj) {
    "use strict";

    // Constructor

    var NegotiateResponse = function() {
        this.types_ = new Types();
        
        this.structureSize_ = 0;
        this.securityMode_ = 0;
        this.dialectRevision_ = 0;
        this.serverGuid_ = "";
        this.capabilities_ = 0;
        this.maxTransaction_ = 0;
        this.maxReadSize_ = 0;
        this.maxWriteSize_ = 0;
        this.systemTime_ = null;
        this.serverStartTime_ = null;
        this.securityBufferOffset_ = 0;
        this.securityBufferLength_ = 0;
        this.buffer_ = null;
        
        this.mechTypes_ = [];
    };

    // Public functions

    NegotiateResponse.prototype.load = function(packet) {
        var array = packet.getPacketHelper().getSmbDataUint8Array();
        
        this.structureSize_ = this.types_.getFixed2BytesValue(array, 0);
        this.securityMode_ = this.types_.getFixed2BytesValue(array, 2);
        this.dialectRevision_ = this.types_.getFixed2BytesValue(array, 4);
        this.serverGuid_ = this.types_.getFixedLengthString(array, 8, 16);
        this.capabilities_ = this.types_.getFixed4BytesValue(array, 24);
        this.maxTransaction_ = this.types_.getFixed4BytesValue(array, 28);
        this.maxReadSize_ = this.types_.getFixed4BytesValue(array, 32);
        this.maxWriteSize_ = this.types_.getFixed4BytesValue(array, 36);
        this.systemTime_ = this.types_.getDateFromArray(array, 40);
        this.serverStartTime_ = this.types_.getDateFromArray(array, 48);
        this.securityBufferOffset_ = this.types_.getFixed2BytesValue(array, 56);
        this.securityBufferLength_ = this.types_.getFixed2BytesValue(array, 58);
        this.buffer_ = array.subarray(this.securityBufferOffset_ - Constants.SMB2_HEADER_SIZE, array.length);
        
        var asn1Obj = Asn1Obj.load(this.buffer_);
        Debug.log(asn1Obj);
        var spnego = asn1Obj.getChild(0).getValueAsObjectIdentifier();
        Debug.info("SPNEGO = " + (spnego === Constants.ASN1_OID_SPNEGO));
        var seq = asn1Obj.getChild(1).getChildren();
        var oids = seq[0].getChild(0).getChild(0).getChildren();
        for (var i = 0; i < oids.length; i++) {
            var oid = oids[i].getValueAsObjectIdentifier();
            Debug.info("Supported mechType: " + oid);
            this.mechTypes_.push(oid);
        }
    };
    
    NegotiateResponse.prototype.getStructureSize = function() {
        return this.structureSize_;
    };

    NegotiateResponse.prototype.getSecurityMode = function() {
        return this.securityMode_;
    };

    NegotiateResponse.prototype.getDialectRevision = function() {
        return this.dialectRevision_;
    };

    NegotiateResponse.prototype.getServerGuid = function() {
        return this.serverGuid_;
    };

    NegotiateResponse.prototype.getCapabilities = function() {
        return this.capabilities_;
    };

    /*jslint bitwise: true */
    NegotiateResponse.prototype.isCapabilityOf = function(name) {
        return (this.capabilities_ & name) !== 0;
    };

    NegotiateResponse.prototype.getMaxTransaction = function() {
        return this.maxTransaction_;
    };

    NegotiateResponse.prototype.getMaxReadSize = function() {
        return this.maxReadSize_;
    };

    NegotiateResponse.prototype.getMaxWriteSize = function() {
        return this.maxWriteSize_;
    };

    NegotiateResponse.prototype.getSystemTime = function() {
        return this.systemTime_;
    };

    NegotiateResponse.prototype.getServerStartTime = function() {
        return this.serverStartTime_;
    };

    NegotiateResponse.prototype.getSecurityBufferLength = function() {
        return this.securityBufferLength_;
    };

    NegotiateResponse.prototype.getSecurityBufferOffset = function() {
        return this.securityBufferOffset_;
    };

    NegotiateResponse.prototype.getBuffer = function() {
        return this.buffer_;
    };
    
    NegotiateResponse.prototype.isSupportedMechType = function(mechType) {
        return this.mechTypes_.indexOf(mechType) !== -1;
    };

    // Export

    Models.NegotiateResponse = NegotiateResponse;

})(SmbClient.Smb2.Models, SmbClient.Types, SmbClient.Constants, SmbClient.Debug, SmbClient.Spnego.Asn1Obj);
