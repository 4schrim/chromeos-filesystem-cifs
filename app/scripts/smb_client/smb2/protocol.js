(function(Smb2,
          Constants,
          Packet,
          Header,
          Types,
          NegotiateResponse,
          Type1Message,
          SessionSetupRequest,
          SessionSetupResponse,
          Type3Message,
          NtlmV2Hash,
          LmV2Response,
          NtlmV2Response,
          LmHash,
          LmResponse,
          NtlmHash) {

    "use strict";

    // Constructor

    var Protocol = function() {
        this.types_ = new Types();

        this.sequenceNumber_ = 1;
    };

    // Public functions
    
    Protocol.prototype.parseNegotiateResponse = function(packet) {
        var negotiateResponse = new NegotiateResponse();
        negotiateResponse.load(packet);
        return negotiateResponse;
    };

    /*jslint bitwise: true */
    Protocol.prototype.createSessionSetupRequestType1Packet = function(session, negotiateResponse) {
        var header = createHeader.call(this, Constants.SMB2_SESSION_SETUP, {
            processId: session.getProcessId()
        });

        var type1Message = new Type1Message();
        type1Message.setFlag(
              Constants.NTLMSSP_NEGOTIATE_UNICODE
            | Constants.NTLMSSP_REQUEST_TARGET
            | Constants.NTLMSSP_NEGOTIATE_NTLM
            | Constants.NTLMSSP_NEGOTIATE_OEM_DOMAIN_SUPPLIED
            | Constants.NTLMSSP_NEGOTIATE_OEM_WORKSTATION_SUPPLIED
            | Constants.NTLMSSP_NEGOTIATE_NTLM2
            | Constants.NTLMSSP_NEGOTIATE_128
        );
        type1Message.setSuppliedDomain("?");
        type1Message.setSuppliedWorkstation("FSP_CIFS");

        var sessionSetupRequest = new SessionSetupRequest();
        sessionSetupRequest.load(negotiateResponse, {
            ntlmMessage: type1Message
        });

        var packet = new Packet();
        packet.set(Constants.PROTOCOL_VERSION_SMB2, header, sessionSetupRequest);
        return packet;
    };
    
    Protocol.prototype.parseSessionSetupResponse = function(packet) {
        var sessionSetupResponse = new SessionSetupResponse();
        sessionSetupResponse.load(packet);
        return sessionSetupResponse;
    };
    
    Protocol.prototype.createSessionSetupRequestType3Packet = function(session, username, password, domainName, negotiateResponse, type2Message) {
        var header = createHeader.call(this, Constants.SMB2_SESSION_SETUP, {
            processId: session.getProcessId(),
            userId: session.getUserId()
        });

        var serverChallenge = type2Message.getChallenge();

        var type3Message = new Type3Message();

        if (type2Message.isFlagOf(Constants.NTLMSSP_NEGOTIATE_NTLM2)) { // LMv2 and NTLMv2
            var lmV2HashObj = new NtlmV2Hash();
            var lmV2Hash = lmV2HashObj.create(username, password, domainName);
            var lmV2ResponseObj = new LmV2Response();
            var lmV2Response = lmV2ResponseObj.create(lmV2Hash, serverChallenge);
    
            var ntlmV2HashObj = new NtlmV2Hash();
            var ntlmV2Hash = ntlmV2HashObj.create(username, password, domainName);
            var ntlmV2ResponseObj = new NtlmV2Response();
            var targetInformation = type2Message.getTargetInformation();
            var ntlmV2Response = ntlmV2ResponseObj.create(ntlmV2Hash, serverChallenge, targetInformation);
    
            type3Message.setLmResponse(lmV2Response);
            type3Message.setNtlmResponse(ntlmV2Response);

            type3Message.setFlag(
                  Constants.NTLMSSP_NEGOTIATE_UNICODE
                | Constants.NTLMSSP_NEGOTIATE_NTLM2
            );
        } else { // LMv1 and NTLMv1
            var lmHashObj = new LmHash();
            var lmHash = lmHashObj.create(password);
            var lmResponseObj = new LmResponse();
            var lmResponse = lmResponseObj.create(lmHash, serverChallenge);

            var ntlmHashObj = new NtlmHash();
            var ntlmHash = ntlmHashObj.create(password);
            var ntlmResponseObj = new LmResponse();
            var ntlmResponse = ntlmResponseObj.create(ntlmHash, serverChallenge);

            type3Message.setLmResponse(lmResponse);
            type3Message.setNtlmResponse(ntlmResponse);

            type3Message.setFlag(
                  Constants.NTLMSSP_NEGOTIATE_UNICODE
                | Constants.NTLMSSP_NEGOTIATE_NTLM
            );
        }

        type3Message.setDomainName(domainName);
        type3Message.setUsername(username);
        type3Message.setWorkstationName("FSP_CIFS");
        type3Message.setSessionKey(null);
        type3Message.load(type2Message);

        var sessionSetupRequest = new SessionSetupRequest();
        sessionSetupRequest.load(negotiateResponse, {
            ntlmMessage: type3Message
        });

        var packet = new Packet();
        packet.set(Constants.PROTOCOL_VERSION_SMB2, header, sessionSetupRequest);
        return packet;
    };

    // options: userId
    var createHeader = function(command, options) {
        var userId = options.userId || 0;
        var treeId = options.treeId || 0;
        var processId = options.processId || 0;

        var header = new Header();
        header.setCommand(command);
        header.setFlags(0);
        header.setChannelSequence(0);
        header.setMessageId(this.sequenceNumber_);
        header.setTreeId(treeId);
        header.setProcessId(processId);
        header.setSessionId(userId);

        this.sequenceNumber_++;

        return header;
    };

    // Export

    Smb2.Protocol = Protocol;

})(SmbClient.Smb2,
   SmbClient.Constants,
   SmbClient.Packet,
   SmbClient.Smb2.Models.Header,
   SmbClient.Types,
   SmbClient.Smb2.Models.NegotiateResponse,
   SmbClient.Auth.Type1Message,
   SmbClient.Smb2.Models.SessionSetupRequest,
   SmbClient.Smb2.Models.SessionSetupResponse,
   SmbClient.Auth.Type3Message,
   SmbClient.Auth.NtlmV2Hash,
   SmbClient.Auth.LmV2Response,
   SmbClient.Auth.NtlmV2Response,
   SmbClient.Auth.LmHash,
   SmbClient.Auth.LmResponse,
   SmbClient.Auth.NtlmHash);
