//Smart-contract: SuperMiner

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

//{Top:[{Acc:uint32, Score:uint32}], LAcc:uint32,WinBlock:uint,TScore:uint32,Round:uint16,InvAcc:uint32,CheckIn:uint32,HTMLBlock:uint,HTMLTr:uint16}

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
DoNewRound(1);
}

function OnSetSmart()//link smart
{
var UState=ReadState(context.Account.Num);
UState.Top=[{Acc:0,Score:0}];
for(var k=0; k<3;k++)  
	UState.Top.push({Acc:10,Score:0});
UState.Top.push({Acc:0,Score:0});
WriteState(UState);
}

function OnDeleteSmart()//unlink smart
{
DoQuitTop();
}

function OnGet()
{
var lib=GetLib();
if(lib.OnGet())
	return;
}

function OnSend()
{
if(context.Smart.Account!=context.Account.Num)
{
    var UState=ReadState(context.Account.Num);
    var AccValue=context.Account.Value;
    var CtxValue=context.Value;
    if(AccValue.SumCOIN<UState.Top[4].Score)
        throw "Unlock:"+(UState.Top[4].Score-AccValue.SumCOIN)+" TERA";
}
}

function DoQuitTop()
{
var SStateA=ReadState(context.Smart.Account+0);
var SStateB=ReadState(context.Smart.Account+1);
var UState=ReadState(context.Account.Num);
if(SStateA.LAcc==context.Account.Num)
	SStateA.LAcc=0;
var Top=ArrConcat(SStateA.Top,SStateB.Top);
for(var j=0; j<Top.length;j++)  
{
	if(Top[j].Acc==context.Account.Num)
	{
		Top.splice(j,1);
		break;
	}	
}
SStateA.Top=Top.splice(0,Math.min(5,Top.length));
SStateB.Top=Top;
SStateA.CheckIn-=UState.TScore;
WriteState(SStateA);
WriteState(SStateB);
}

function DoNewRound(tid)
{
var SStateA=ReadState(context.Smart.Account+0);
var SStateB=ReadState(context.Smart.Account+1);
SStateA.Top=[];
SStateB.Top=[];
SStateA.WinBlock=context.BlockNum + 1200*24*10;
SStateA.Round+=1;
SStateA.CheckIn=0;
SStateA.TScore=0;
SStateA.InvAcc=0;
SStateA.LAcc=0;
WriteState(SStateA);
WriteState(SStateB);
DoEvent(context.Smart.Account,0,[1,SStateA.Round],tid);
}

function DoPay(tid)
{
var SStateA=ReadState(context.Smart.Account+0);
var SStateB=ReadState(context.Smart.Account+1);
var Top=ArrConcat(SStateA.Top,SStateB.Top);
if(Top.length)
{
	if(!SStateA.TScore)
	{
		var sum=0;
		for(var j=0;j<Top.length;j++)
			sum+=Top[j].Score;
		SStateA.TScore=sum; //store sum of top score.
		SStateA.InvAcc=ReadAccount(context.Smart.Account).Value.SumCOIN;  //store final jackpot.
	}
	var totalScore=SStateA.TScore;
	var totalPot=SStateA.InvAcc;
	var topLength=Top.length;
	var winner;
	for(var k=0;k<topLength&&k<3;k++)
	{
		winner=Top.pop();
		Move(context.Smart.Account,winner.Acc, Math.trunc(winner.Score/totalScore*totalPot*5/10),"Top reward");
	}
	SStateA.Top=Top.splice(0,Math.min(5,Top.length));
	SStateB.Top=Top;
	WriteState(SStateA);
	WriteState(SStateB);
	DoEvent(context.Smart.Account,0,[0],tid);
}
else 
{
	if(SStateA.LAcc)
		Move(context.Smart.Account,SStateA.LAcc, Math.trunc(SStateA.InvAcc/10), "");
	DoNewRound(tid);
}
}

function ArrConcat(ArrA,ArrB)
{
var Top=ArrA;
for(var i=0;i<ArrB.length;i++)
	Top.push(ArrB[i]);
return Top;
}

function RandHalf(rnd)
{
return parseUint(rnd)>0?Math.trunc((rnd+context.BlockHash[8]%parseUint(rnd))/2):0;
}

function DoTop(UState,IState,wscore)
{
var SStateA=ReadState(context.Smart.Account+0);
var SStateB=ReadState(context.Smart.Account+1);
var Top=ArrConcat(SStateA.Top,SStateB.Top);
if(IState.Num)
{
	for(var k=0; k<Top.length;k++)  
	{
		if(Top[k].Acc==IState.Num)
		{
			Top.splice(k,1);
			break;
		}	
	}
	Top.push({Acc:IState.Num,Score:IState.TScore});
}
for(var j=0; j<Top.length;j++)  
{
	if(Top[j].Acc==UState.Num)
	{
		Top.splice(j,1);
		break;
	}	
}
Top.push({Acc:UState.Num,Score:UState.TScore});
Top=Top.sort(function(a,b){return b.Score==a.Score?a.Acc-b.Acc:b.Score-a.Score});
if(Top.length>10)
	Top.splice(10,Top.length-10);
SStateA.Top=Top.splice(0,Math.min(5,Top.length));
SStateB.Top=Top;
SStateA.CheckIn+=wscore;
WriteState(SStateA);
WriteState(SStateB);
}

function DoUpdateRound(UState,SState,tid)
{
var score=Math.trunc(UState.TScore*Math.pow(3,Math.max(-12,UState.Round-SState.Round)));//keep 1/3 score
UState.TScore=score;
UState.InvAcc=0;
UState.Round=SState.Round;
UState.CheckIn=0;
UState.Top[4].Score=0;
WriteState(UState);
if(score)
    DoTop(UState,{"Num":0},score);
DoEvent(UState.Num, 0, [3],tid);
}

function DoEvent(acc,act,info,tid)
{
Event({"Acc":acc,"Act":act,"Info":info,"Tid":tid});
}

function DoMobai(UState,tAcc,SState,tid)
{
var TState=ReadState(tAcc);
var caidiNum=context.BlockHash[8]%4;
var caidi=TState.Top[caidiNum];
var reward=0;
if(caidi.Acc==8)
{
	reward=RandHalf(80);
	Move(UState.Num,tAcc,20, "");
}
else if(caidi.Acc>0&&caidi.Acc<8)
{
	reward=RandHalf(40);
	Move(UState.Num,context.Smart.Account,20, "");
}
if(reward)
{
	UState.TScore+=reward;
	TState.Top[caidiNum].Score+=reward;
	WriteState(TState);
	DoTop(UState,{"Num":0},reward); 
}
UState.HTMLBlock=context.BlockNum+2400;
WriteState(UState);
DoEvent(UState.Num, 7, [tAcc,reward],tid);
}

function DoCaidi(UState,bet,tid)
{
if(bet[1]&&bet[1]<9&&((bet[0]+1)*2>=bet[1])&&!UState.Top[bet[0]].Acc)
{

	UState.Top[bet[0]].Acc=bet[1];
	UState.Top[bet[0]].Score=context.BlockNum+bet[1]*1200*8;
	Move(UState.Num,context.Smart.Account,bet[1]*100, "");
	WriteState(UState);
	DoEvent(UState.Num, 6, [0,bet[0],bet[1]],tid);
}
else if(UState.Top[bet[0]].Acc&&UState.Top[bet[0]].Score<context.BlockNum)
{
	var vegscore=Math.trunc(300*UState.Top[bet[0]].Acc*Math.pow(1.06,UState.Top[bet[0]].Acc))
	DoEvent(UState.Num, 6, [1,bet[0],vegscore],tid);
	UState.TScore+=vegscore;
	UState.Top[bet[0]].Acc=0;
	UState.Top[bet[0]].Score=0;
	WriteState(UState);    
	DoTop(UState,{"Num":0},vegscore);
}
else
	throw "Caidi";
}

function DoSlot(UState,tid)
{
//generate Slot result.	
var ArrLotto=[context.BlockHash[16]%6+1,context.BlockHash[14]%6+1,context.BlockHash[12]%6+1];
var LottoOrigin=ArrLotto[0]*100+ArrLotto[1]*10+ArrLotto[2];
ArrLotto.sort(function(a,b) {return a-b});
var x=ArrLotto[0],y=ArrLotto[1],z=ArrLotto[2];
//calculate reward
var Reward=0;
var bet=20;
var lTypeANormal=[2,3,5,10,30,666];
var lTypeBNormal=[0.25,0.5,1,3,5,0];
var lTypeABonus=[10,25,50,100,777,1666];
var lTypeBBonus=[1,2,5,10,25,100];
var lTypeA, lTypeB;
if(UState.WinBlock>0)
{
	lTypeA=lTypeABonus;
	lTypeB=lTypeBBonus;
	UState.WinBlock-=1;
}
else
{
	lTypeA=lTypeANormal;
	lTypeB=lTypeBNormal;
	Move(UState.Num,context.Smart.Account, bet, "");
}

if(x==y&&y==z)
	Reward=lTypeA[y-1];
else if(x==y||y==z)
	Reward=lTypeB[y-1];
if(Reward>665) //Unlock caidi
{
	for(var k=0; k<4; k++)
		if(UState.Top[k].Acc==10)
		{
			UState.Top[k].Acc=0;
			break;
		}
}	
if(Reward==666) //BonusMode Unlocked
{
	UState.WinBlock=5;
	DoEvent(UState.Num,5,[0,LottoOrigin,0],tid);
} 
else //pay reward
{
	var Scoin=ReadAccount(context.Smart.Account).Value.SumCOIN;
	var bonus=Math.min(Reward*bet,Scoin/5);
	if(bonus>0)
	{
		Move(context.Smart.Account, context.FromNum, bonus, "");
		UState.CheckIn-=(UState.CheckIn-40)>context.BlockNum?40:0;
	}
	DoEvent(UState.Num,5,[1,LottoOrigin,bonus],tid);
}
UState.LAcc=LottoOrigin;
WriteState(UState);
}

function DoInvite(UState,InvAcc,tid)
{
UState.InvAcc=InvAcc;
WriteState(UState);
DoEvent(UState.Num,4,[InvAcc],tid);
}

function SetBuff(locked)
{
return Math.min(5,Math.trunc(locked/1e5))*0.01+1;
}
function DoLogIn(UState,SState,tid)
{
var block=1200*24, score=16, reward=0;
var Scoin=ReadAccount(context.Smart.Account).Value.SumCOIN;
if(UState.TScore&&Scoin)
{
    var CIndex=Math.min(Math.max(256,Math.trunc(SState.CheckIn*30/Scoin)),1024);
    reward=Math.min(Scoin, UState.TScore/CIndex*SetBuff(UState.Top[4].Score));
    if(reward>1 && reward*1.02<Scoin)
	Move(context.Smart.Account,context.Smart.Owner, reward*0.02,"Owner");
    Move(context.Smart.Account,UState.Num, reward,"SuperMiner");
}
UState.CheckIn=context.BlockNum+block;
score*=Math.pow(2,Math.max(-3,Math.trunc(-UState.TScore/128)));
UState.TScore+=score;
WriteState(UState);
DoTop(UState,{"Num":0},score);
DoEvent(UState.Num,3,[score,reward],tid);
}

function DoLock(UState,bet,tid)
{
    var lockedcoin=UState.Top[4].Score;
    DoEvent(UState.Num, 2, [bet-lockedcoin],tid);
    UState.Top[4].Score=bet;
    WriteState(UState);
    if(lockedcoin>bet)
        Move(UState.Num,context.Smart.Account,(lockedcoin-bet)/100, "");
}

function DoMine(UState,bet,tid)
{
var RATIO=2, wscore=0;
Move(UState.Num,context.Smart.Account,bet, "");
var SState=ReadState(context.Smart.Account);
SState.LAcc=UState.Num;
SState.WinBlock+=bet;
WriteState(SState);
//InvAcc Bonus
var InvAcc=UState.InvAcc;
var IState={"Num":0};
var TScore=RandHalf(bet*RATIO);
if(ReadAccount(InvAcc).Value.Smart==context.Smart.Num)
{
	IState=ReadState(InvAcc);
	if(IState.Round==SState.Round)
	{
	    IState.TScore+=Math.trunc(TScore/10);
	    wscore+=Math.trunc(TScore/10);
	    WriteState(IState);
	    TScore+=Math.trunc(TScore/10);
	}
	else
	    IState={"Num":0};
}
UState.TScore+=TScore;
wscore+=TScore;
WriteState(UState);
DoEvent(UState.Num,1,[TScore],tid);
DoTop(UState,IState,wscore);
}

"public"
function Round(Params)
{
CheckPermission();
var SState=ReadState(context.Smart.Account);
var tid=parseUint(Params.tid);
if(SState.WinBlock<context.BlockNum)    //DoPay
{
	DoPay(tid);
}
else if(ReadAccount(context.Smart.Account).Value.SumCOIN<100)
{
    if(SState.WinBlock-context.BlockNum>100)
    {
        SState.WinBlock=context.BlockNum+100;
        WriteState(SState);
    }
    DoEvent(context.Smart.Account, 0, [2],tid);
}
else //DoCMD
{
var bet=parseUint(Params.bet);
var cmd=parseUint(Params.cmd);
var msg=Params.msg;
var UserAcc=context.Account.Num;
var UState=ReadState(UserAcc);
if(UState.Round!=SState.Round)
    DoUpdateRound(UState,SState,tid);
else
{
	switch(cmd)
	{
		case 1:
		    if(bet>=100&&(bet%100==0)&&bet<10001)
			    DoMine(UState,bet,tid);
			else
			    throw "Mine";
		break;
		case 2:
		    if(bet!=UState.Top[4].Score&&bet<=ReadAccount(UState.Num).Value.SumCOIN)
			    DoLock(UState,bet,tid);
			else
			    throw "Lock";
		break;
		case 3:
		    if(UState.CheckIn&&UState.CheckIn<context.BlockNum)
			    DoLogIn(UState,SState,tid);
			else
			    throw "LogIn";			    
		break;
		case 4:
		    if(bet>=16&&(bet!=context.Smart.Account)&&(bet!=(context.Smart.Account+1))&&bet!=context.Account.Num&&!UState.InvAcc&&(ReadAccount(bet).Value.Smart==context.Smart.Num))
			    DoInvite(UState,bet,tid);
			else
			    throw "Invite";
		break;   
		case 5:
		    DoSlot(UState,tid);
		break;
		case 6:
			DoCaidi(UState,msg,tid);
		break;
		case 7:
            var bTop=false;
            for(var i=0; i<SState.Top.length; i++)
            	if(SState.Top[i].Acc==bet)
            		bTop=true;
		    if(bet>=16&&(bet!=context.Smart.Account)&&(bet!=(context.Smart.Account+1))&&bet!=context.Account.Num&&bTop&&UState.HTMLBlock<context.BlockNum)
			    DoMobai(UState,bet,SState,tid);
        	else
        	    throw "Mobai";
		break;		
		case 9:
		    if(msg[0].length>0&&msg[0].length<101)
			    DoEvent(context.Account.Num, 9, msg, tid);
        	else
        	    throw "Chat";			    
		break;		
		default:
		    throw "Invalid operation";
	}
}
}
}

"public"
function ReadTop()
{
var SStateA=ReadState(context.Smart.Account+0);
var SStateB=ReadState(context.Smart.Account+1);
return ArrConcat(SStateA.Top,SStateB.Top);
}
