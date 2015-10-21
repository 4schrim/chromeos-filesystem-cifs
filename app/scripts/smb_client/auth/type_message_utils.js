(function(Auth,
          Debug,
          Constants,
          Type3Message,
          LmHash,
          LmResponse,
          NtlmHash,
          NtlmV2Hash,
          NtlmV2Response,
          LmV2Response) {
    "use strict";
    
    // Constructor
    var TypeMessageUtils = function() {
    };
    
    // Public functions
    
    /*jslint bitwise: true */
    TypeMessageUtils.prototype.createType3Message = function(
            username, password, domainName, serverChallenge, type2Message, lmCompatibilityLevel) {
        var type3Message = new Type3Message();

        // TODO Check whether or not the NEGOTIATE_NTLM2_KEY flag.
        
        switch(lmCompatibilityLevel) {
            case 0:
            case 1:
                Debug.info("Use LMv1 and NTLMv1 because LMCompatibilityLevel=" + lmCompatibilityLevel);
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
                break;
            case 2:
                Debug.info("Use both NTLMv1 because LMCompatibilityLevel=" + lmCompatibilityLevel);
                ntlmHashObj = new NtlmHash();
                ntlmHash = ntlmHashObj.create(password);
                ntlmResponseObj = new LmResponse();
                ntlmResponse = ntlmResponseObj.create(ntlmHash, serverChallenge);
    
                type3Message.setLmResponse(ntlmResponse);
                type3Message.setNtlmResponse(ntlmResponse);
                break;
            case 3:
            case 4:
            case 5:
                Debug.info("Use LMv2 and NTLMv2 because LMCompatibilityLevel=" + lmCompatibilityLevel);
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
        }

        type3Message.setFlag(
              Constants.NTLMSSP_NEGOTIATE_UNICODE
            | Constants.NTLMSSP_NEGOTIATE_NTLM
        );
        type3Message.setDomainName(domainName);
        type3Message.setUsername(username);
        type3Message.setWorkstationName("FSP_CIFS");
        type3Message.setSessionKey(null);
        type3Message.load(type2Message);
        
        return type3Message;
    };
    
    // Export
    Auth.TypeMessageUtils = TypeMessageUtils;
    
})(SmbClient.Auth,
   SmbClient.Debug,
   SmbClient.Constants,
   SmbClient.Auth.Type3Message,
   SmbClient.Auth.LmHash,
   SmbClient.Auth.LmResponse,
   SmbClient.Auth.NtlmHash,
   SmbClient.Auth.NtlmV2Hash,
   SmbClient.Auth.NtlmV2Response,
   SmbClient.Auth.LmV2Response);
