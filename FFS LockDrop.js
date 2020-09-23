//Smart-contract: FFS LockDrop
/*
global context:
context.BlockNum - Block num
context.Account - current account {Num,Currency,Smart,Value:{SumCOIN,SumCENT}}
context.Smart - current smart {Num,Name,Account,Owner}
context.FromNum - sender account num
context.ToNum - payee account num
context.Description - text
context.Value - {SumCOIN,SumCENT};
*/

function GetLib()
{
    return require(8);//List-lib
}

function CheckPermission()
{
    if(context.Account.Num!==context.FromNum)
        throw "Access is allowed only from your own account.";
}

function OnCreate()//create new smart
{
    DoInit(context.Smart.Account);
}

function OnSetSmart()//link smart
{
    DoInit(context.Account.Num);
}

function OnDeleteSmart()//unlink smart
{
    var UState=ReadState(context.Account.Num);
    if(GetLocked(UState))
        throw "Unlock firstly";
}

function OnGet()
{
    var lib=GetLib();
    if(lib.OnGet())
        return;
}

function OnSend()
{
    if(context.Account.Num!=context.Smart.Account)
    {
        var UState=ReadState(context.Account.Num);
        var Locked=GetLocked(UState);
        var AccValue=context.Account.Value;
        var CtxValue=context.Value;
        if(AccValue.SumCOIN<Locked)
            throw "Locked Coin: "+Locked;
    }
}

function GetLocked(UState)
{
    return UState.Slot[0].Amount+UState.Slot[1].Amount+UState.Slot[2].Amount;    
}

function DoInit(Acc)
{
    var UState=ReadState(Acc);
    UState.Slot=[];
    for(var k=0; k<3;k++)  
	    UState.Slot.push({Amount:0,EndBlock:0});
    WriteState(UState);
}

function GetBase()
{
    var resttoken=ReadAccount(context.Smart.Account).Value.SumCOIN;
    return Math.pow(2,Math.ceil(resttoken/2e7)-5)/500;
}

function DoEvent(acc,act)
{
    Event({"Acc":acc,"Act":act});
}

function Qualify(expected,errinfo)
{
    if(!expected)
        throw errinfo;
}

function CheckLock(UState)
{
    var bLock=true;
    for(var i=0; i<UState.Slot.length; i++)
    {
        if(UState.Slot[i].EndBlock&&UState.Slot[i].EndBlock<context.BlockNum)
        {
            bLock=false;
            break;
        }
    }
    return bLock;
}

//{Slot:[{Amount:uint32, EndBlock:uint}],ClaimBlock:uint,peer:uint32,HTMLBlock:uint,HTMLTr:uint16}
"public"
function Round(Params)
{
    CheckPermission();
    var SState=ReadState(context.Smart.Account);
    var UState=ReadState(context.FromNum);
    var SAccount=ReadAccount(SState.Num);
    var UAccount=ReadAccount(UState.Num);
    var cmd=Params.cmd;
    var slot=0, amount=0, peer=0;
    var scoin=FLOAT_FROM_COIN(SAccount.Value);
    switch (cmd) 
    {
        case 'bind':
            peer=parseUint(Params.peer);
            Qualify(peer>15,"Invalid account");
            var PAccount=ReadAccount(peer);
            Qualify(PAccount.Currency==SAccount.Currency,"Wrong Currency");
            UState.peer=peer;
            WriteState(UState);
            DoEvent(UState.Num, cmd);
            break;
        case 'lock':
            Qualify(UState.peer,"No peer");
            Qualify(UAccount.Currency===0,"TERA Account Only");
            Qualify(scoin,"Hey, party is over");            
            Qualify(CheckLock(UState),"Unlock firstly");
            slot=parseUint(Params.slot);
            amount=parseUint(Params.amount);
            var rest=UAccount.Value.SumCOIN-GetLocked(UState);
            var lockday=[7,30,365];
            Qualify(slot<3&&amount>0&&rest&&amount<=rest,"Invalid amount");
            UState.Slot[slot].Amount+=amount;
            SState.Slot[slot].Amount+=amount;
            UState.Slot[slot].EndBlock=context.BlockNum+28800*lockday[slot];
            UState.ClaimBlock=context.BlockNum+120;
            WriteState(UState);
            WriteState(SState);
            DoEvent(UState.Num, cmd);
            break;
        case 'unlock':
            slot=parseUint(Params.slot);
            Qualify(slot<3,"Invalid slot");
            Qualify(UState.Slot[slot].Amount&&UState.Slot[slot].EndBlock&&UState.Slot[slot].EndBlock<context.BlockNum,"Not ready yet");
            SState.Slot[slot].Amount-=UState.Slot[slot].Amount;
            UState.Slot[slot].Amount=0;
            UState.Slot[slot].EndBlock=0;
            if(!GetLocked(UState))
                UState.ClaimBlock=0;
            WriteState(UState);
            WriteState(SState);
            DoEvent(UState.Num, cmd);
            break;
        case 'claim':
            Qualify(scoin,"Hey, party is over");
            Qualify(CheckLock(UState),"Unlock firstly");
            Qualify(UState.ClaimBlock&&UState.ClaimBlock<context.BlockNum,"Not ready yet");
            var base=GetBase();
            var token=Math.min((UState.Slot[0].Amount/2+UState.Slot[1].Amount+UState.Slot[2].Amount*4)*base, scoin);
            Qualify(token>1e-9,"Lock more TERA");
            UState.ClaimBlock=context.BlockNum+1200*23;
            Move(context.Smart.Account,UState.peer, token, "");
            var otoken=Math.min(token*0.06,scoin);
            if(otoken>1e-9)
                Move(context.Smart.Account,SState.peer, otoken, "");
            WriteState(UState);
            DoEvent(UState.Num, cmd);
            break;
        case 'bindme':
            peer=parseUint(Params.peer);
            Qualify(peer>15&&UState.Num===context.Smart.Owner,"OOIOO");
            SState.peer=peer;
            WriteState(SState);
            DoEvent(UState.Num, cmd);
            break;            
        default:
            throw "Invalid operation";
    }
}
