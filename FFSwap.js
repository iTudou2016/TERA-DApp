//Smart-contract: FFSwap
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

}

function OnSetSmart()//link smart
{

}

function OnDeleteSmart()//unlink smart
{
    var UState=ReadState(context.FromNum);
    Qualify(!(UState.pprev||UState.share),"Delete");
}

function OnGet()
{
    var lib=GetLib();
    if(lib.OnGet())
        return;
}

function OnSend()
{
    var UState=ReadState(context.FromNum);
    Qualify(!(!context.SmartMode&&UState.pprev),"Send");
}

//{peer:uint,pprev:uint,pnext:uint,token:{SumCOIN:uint,SumCENT:uint32},coin:{SumCOIN:uint,SumCENT:uint32},share:double,HTMLBlock:uint,HTMLTr:uint16}
function DoEvent(acc,act,info,tid)
{
Event({"Acc":acc,"Act":act});
}

function Qualify(expected,errinfo)
{
    if(!expected)
        throw "ERR: " +errinfo;
}

function GetInputPrice(x, y, deltax, fee)
{
	var alpha=deltax/x;
	var gama=(1-fee);
	var deltay=alpha*gama/(1+alpha*gama)*y;
	var oprice=x/y;
	var nprice=deltax/deltay;
	var ratio=(nprice-oprice)/oprice;
	return {"oprice":oprice,"nprice":nprice,"ratio":ratio,"output":deltax,"input":deltay};
}

function GetOutputPrice(x, y, deltay, fee)
{
	var beta=deltay/y;
	var gama=(1-fee);
	var deltax=beta/((1-beta)*gama)*x;
	var oprice=x/y;
	var nprice=deltax/deltay;
	var ratio=(nprice-oprice)/oprice;
	return {"oprice":oprice,"nprice":nprice,"ratio":ratio,"output":deltax,"input":deltay};
}

function DoBind(UState,peer)
{
    UState.peer=peer;
    WriteState(UState);
}

function DoNew(UState,PState,UAccount)
{
	Move(UState.peer,context.Smart.Owner,44,"Liquid Pool"); 
	UState.peer=0;
	if(PState.pnext) //middle
	{
	    var NAccount=ReadAccount(PState.pnext);
		Qualify(UAccount.Currency<NAccount.Currency,"pool 2");
		var NState=ReadState(PState.pnext);
		PState.pnext=UState.Num;
		WriteState(PState);
		UState.pprev=PState.Num;
		UState.pnext=NState.Num;
		WriteState(UState);
		NState.pprev=UState.Num;
		WriteState(NState);
	}
	else //tail
	{
	    PState.pnext=UState.Num;
		WriteState(PState);
		UState.pprev=PState.Num;
		WriteState(UState);
	}    
}

function DoAddLP(UState,PState,Params)
{
    var ptoken=FLOAT_FROM_COIN(PState.token);
    var pcoin=FLOAT_FROM_COIN(PState.coin);
    var output=parseFloat(Params.output)||0;
    var input=parseFloat(Params.input)||0;
    var share=1; //new liquidity
    if(ptoken&&pcoin) //liquidity existed.
    {
        input=output*(pcoin/ptoken);
		share=output/(ptoken/PState.share);
    }
    Qualify(output>1e-9&&input>1e-9,"add 3");
    PState.share+=share;
    UState.share+=share;
    Move(UState.Num,PState.Num,output,""); // token to poor;
    Move(UState.peer,context.Smart.Account,input,""); // coin to smart pool;
    ADD(PState.token,COIN_FROM_FLOAT(output));
    ADD(PState.coin,COIN_FROM_FLOAT(input));
    WriteState(PState);	
    WriteState(UState);
}

function DoRemoveLP(UState,PState,Params)
{
    var ptoken=FLOAT_FROM_COIN(PState.token);
    var pcoin=FLOAT_FROM_COIN(PState.coin);    
    var output=parseFloat(Params.output)||0;
    Qualify(ptoken&&pcoin,"remove 2");    
    var input=output*(pcoin/ptoken);
    Share=output/(ptoken/PState.share);
    PState.share-=Share;
    UState.share-=Share;
    Qualify(output>1e-9&&input>1e-9&&input<=pcoin&&output<=ptoken&&PState.share>=0&&UState.share>=0,"remove 3");
    Move(PState.Num,UState.Num,output,""); //withdraw token to user;
    Move(context.Smart.Account,UState.peer,input,""); //withdraw coin to peer;
    SUB(PState.token,COIN_FROM_FLOAT(output));
    SUB(PState.coin,COIN_FROM_FLOAT(input));
    WriteState(PState);
    WriteState(UState);	    
}

function DoTrade(UState,PState,Params)
{
        var output=parseFloat(Params.output)||0;
        Qualify(output>1e-9,"output");
        var slide=parseFloat(Params.slide);
        var poolb=parseUint(Params.poolb);
        var PStateB=ReadState(poolb);
        var ptoken=FLOAT_FROM_COIN(PState.token);
        var pcoin=FLOAT_FROM_COIN(PState.coin);
        var ptokenB=FLOAT_FROM_COIN(PStateB.token);
        var pcoinB=FLOAT_FROM_COIN(PStateB.coin);
        var askAMM, input=0;
        if(PState.pprev&&PStateB.pprev) //T-T
        {
    	    var payee=parseUint(Params.payee);
    		var askAMMB;
            Qualify(ptoken&&pcoin&&ptokenB&&pcoinB,"token/token 1");
			//T > C, C > T
			askAMM=GetInputPrice(ptoken, pcoin, output, 0);
			askAMMB=GetInputPrice(pcoinB, ptokenB, askAMM.input, FEE);  //askAMM.input=askAMMB.output here
            var coinab=askAMMA.input;
            input=askAMMB.input;
            Qualify(output>1e-9&&input>1e-9&&coinab>1e-9,"token/token 2");
            Move(UState.Num, PState.Num, output, ""); // tokena to poola;
            Move(PStateB.Num, payee, input,""); // tokenb to payee;
            ADD(PState.token,COIN_FROM_FLOAT(output));
            SUB(PState.coin,COIN_FROM_FLOAT(coinab));
            ADD(PStateB.coin,COIN_FROM_FLOAT(coinab));
            SUB(PStateB.token,COIN_FROM_FLOAT(input));
            WriteState(PState);	
            WriteState(PStateB);
        }
        else if(PState.pprev&&!PStateB.pprev) //T-C
        {
            Qualify(ptoken&&pcoin,"tokenToCoin 1");
            askAMM=GetInputPrice(ptoken, pcoin, output, FEE);
            input=askAMM.input;
            Qualify(output>1e-9&&input>1e-9,"tokenToCoin 2");
            //Qualify(askAMM.ratio<slide,"tokenToCoin 3");
            Move(UState.Num, PState.Num, output, ""); // token to pool;
            Move(context.Smart.Account, UState.peer, input, ""); // coin to peer;
            ADD(PState.token,COIN_FROM_FLOAT(output));
            SUB(PState.coin,COIN_FROM_FLOAT(input));
            WriteState(PState);	
        }
        else if(!PState.pprev&&PStateB.pprev) //C-T
        {
            Qualify(ptokenB&&pcoinB,"coinToToken 1");
            askAMM=GetInputPrice(pcoinB, ptokenB, output, FEE);
            input=askAMM.input;    
            Qualify(output>1e-9&&input>1e-9,"coinToToken 2");
            //Qualify(askAMM.ratio<slide,"coinToToken 3");   
            Move(PState.Num, UState.Num, input, ""); // token to user;
            Move(UState.peer, context.Smart.Account, output,""); // coin to smart pool;
            SUB(PState.token,COIN_FROM_FLOAT(input));
            ADD(PState.coin,COIN_FROM_FLOAT(output));
            WriteState(PState);	
        }    
}

"public"
function Round(Params)
{
CheckPermission();
//Key for all
var SState=ReadState(context.Smart.Account);
var SAccount=ReadAccount(SState.Num);
var UState=ReadState(context.FromNum);
var UAccount=ReadAccount(UState.Num);
var cmd=Params.cmd;

Qualify(!UState.pprev,"LP Account");
var FEE=3e-3;
var poola=parseUint(Params.poola);  //poola/peer/poolposition
Qualify(poola,"poolA 1");
var PState=ReadState(poola);
var PAccount=ReadAccount(PState.Num);

//Params:{cmd, poola, poolb, output, payee, slide}
switch(cmd)
{
	case "bind"://set peer //Params:{cmd, poola} 
        var bPubkey=JSON.stringify(PAccount.PubKey)==JSON.stringify(UAccount.PubKey); //check PubKey
        Qualify(UAccount.Currency&&!PAccount.Currency&&bPubkey&&PAccount.Value.Smart==UAccount.Value.Smart&&PAccount.Value.Smart==context.Smart.Num,"peer");
        DoBind(UState,PState.Num);
        DoEvent(UState.Num, cmd);
	break;    
	case "new"://add pool sort by Currency //Params:{cmd, poola}
		Qualify(UAccount.Currency&&UState.peer,"pool 0");
		Qualify(UAccount.Currency>PAccount.Currency&&(PState.Num==SState.Num||PState.pprev),"pool 1");
		DoNew(UState,PState,UAccount);
		DoEvent(UState.Num,cmd);
	break;
	case "add"://add to lph //Params:{cmd, poola, output, input} 
	//22nd Sept, 2020, to simplify the process, only output is a must, input only used in new liquidity, the rest input will be calculated by formula.
	//Qualification/execution/notification
        Qualify(PState.pprev&&PAccount.Currency==UAccount.Currency&&UState.peer,"add 1");
        DoAddLP(UState,PState,Params);
        DoEvent(UState.Num,cmd);
	break;
	case "remove"://remove from lph //Params:{cmd, poola, output}
        Qualify(PState.pprev&&PAccount.Currency==UAccount.Currency&&UState.peer,"remove 1");
        DoRemoveLP(UState,PState,Params);
        DoEvent(UState.Num,cmd);
	break;
	case "trade"://swap token to coin //Params:{cmd, poola, poolb, output, payee, slide}
        DoTrade(UState,PState,Params);
        DoEvent(UState.Num,cmd);
	break;
	default:
	    throw "Invalid cmd";
}
}

"public"
function GetPools(ArrPoolAcc)
{
    var Pools=[], Item;
    for(var i=0; i<ArrPoolAcc.length; i++)
    {
        Item=ReadState(ArrPoolAcc[i]);
        if(Item.pprev||Item.Num==context.Smart.Account)
        {
            Item.Currency=ReadAccount(ArrPoolAcc[i]).Currency;
            Pools.push(Item);
        }
    }
    return Pools;
}
