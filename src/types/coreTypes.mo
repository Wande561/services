import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Time "mo:base/Time";

module {

    public type AddConnectingTableRecordArgs = {
        ledger_id : Text;
        record_id : Text;
    };

    public type ConnectingRecord = {
        id : Nat;
        ledger_record_id : Text;
        record_id : Text;
        created_at : Time.Time;
    };

};