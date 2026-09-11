var RW="180",s8={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},o8={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},kW=0,oQ=1,DW=2;var iQ=1,k7=2,L8=3,i8=0,uJ=1,$8=2,a8=0,B6=1,aQ=2,rQ=3,tQ=4,MW=5,i9=100,LW=101,VW=102,zW=103,BW=104,CW=200,_W=201,wW=202,IW=203,PW=204,TW=205,AW=206,SW=207,jW=208,yW=209,vW=210,fW=211,hW=212,xW=213,bW=214,D7=0,M7=1,L7=2,C6=3,V7=4,z7=5,B7=6,C7=7,gW=0,pW=1,lW=2,v8=0,dW=1,mW=2,uW=3,_7=4,cW=5,nW=6,sW=7;var a9=301,R9=302,w7=303,I7=304,_6=306,r9=1000,P7=1001,T7=1002,f8=1003,A7=1004;var k9=1005;var E8=1006,t9=1007;var h8=1008;var r8=1009,oW=1010,iW=1011,w6=1012,eQ=1013,e9=1014,t8=1015,I6=1016,J$=1017,Q$=1018,J6=1020,aW=35902,rW=35899,tW=1021,eW=1022,V8=1023,S7=1026,P6=1027,JH=1028,$$=1029,QH=1030,Z$=1031;var W$=1033,j7=33776,y7=33777,v7=33778,f7=33779,H$=35840,Y$=35841,X$=35842,K$=35843,U$=36196,G$=37492,q$=37496,E$=37808,N$=37809,F$=37810,O$=37811,R$=37812,k$=37813,D$=37814,M$=37815,L$=37816,V$=37817,z$=37818,B$=37819,C$=37820,_$=37821,w$=36492,I$=36494,P$=36495,T$=36283,A$=36284,S$=36285,j$=36286;var y$=2300,h7=2301;var v$=0,T6=1,Q6=2;var $H=3201;var ZH=0,WH=1,D9="",N8="srgb",hJ="srgb-linear",f$="linear",XJ="srgb";var HH=512,YH=513,XH=514,h$=515,KH=516,UH=517,GH=518,qH=519;var x$="300 es",b$=2000;class x8{addEventListener(J,Q){if(this._listeners===void 0)this._listeners={};let $=this._listeners;if($[J]===void 0)$[J]=[];if($[J].indexOf(Q)===-1)$[J].push(Q)}hasEventListener(J,Q){let $=this._listeners;if($===void 0)return!1;return $[J]!==void 0&&$[J].indexOf(Q)!==-1}removeEventListener(J,Q){let $=this._listeners;if($===void 0)return;let Z=$[J];if(Z!==void 0){let W=Z.indexOf(Q);if(W!==-1)Z.splice(W,1)}}dispatchEvent(J){let Q=this._listeners;if(Q===void 0)return;let $=Q[J.type];if($!==void 0){J.target=this;let Z=$.slice(0);for(let W=0,H=Z.length;W<H;W++)Z[W].call(this,J);J.target=null}}}var AJ=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],jZ=1234567,V6=Math.PI/180,F9=180/Math.PI;function G8(){let J=Math.random()*4294967295|0,Q=Math.random()*4294967295|0,$=Math.random()*4294967295|0,Z=Math.random()*4294967295|0;return(AJ[J&255]+AJ[J>>8&255]+AJ[J>>16&255]+AJ[J>>24&255]+"-"+AJ[Q&255]+AJ[Q>>8&255]+"-"+AJ[Q>>16&15|64]+AJ[Q>>24&255]+"-"+AJ[$&63|128]+AJ[$>>8&255]+"-"+AJ[$>>16&255]+AJ[$>>24&255]+AJ[Z&255]+AJ[Z>>8&255]+AJ[Z>>16&255]+AJ[Z>>24&255]).toLowerCase()}function d0(J,Q,$){return Math.max(Q,Math.min($,J))}function g$(J,Q){return(J%Q+Q)%Q}function tY(J,Q,$,Z,W){return Z+(J-Q)*(W-Z)/($-Q)}function eY(J,Q,$){if(J!==Q)return($-J)/(Q-J);else return 0}function z6(J,Q,$){return(1-$)*J+$*Q}function JX(J,Q,$,Z){return z6(J,Q,1-Math.exp(-$*Z))}function QX(J,Q=1){return Q-Math.abs(g$(J,Q*2)-Q)}function $X(J,Q,$){if(J<=Q)return 0;if(J>=$)return 1;return J=(J-Q)/($-Q),J*J*(3-2*J)}function ZX(J,Q,$){if(J<=Q)return 0;if(J>=$)return 1;return J=(J-Q)/($-Q),J*J*J*(J*(J*6-15)+10)}function WX(J,Q){return J+Math.floor(Math.random()*(Q-J+1))}function HX(J,Q){return J+Math.random()*(Q-J)}function YX(J){return J*(0.5-Math.random())}function XX(J){if(J!==void 0)jZ=J;let Q=jZ+=1831565813;return Q=Math.imul(Q^Q>>>15,Q|1),Q^=Q+Math.imul(Q^Q>>>7,Q|61),((Q^Q>>>14)>>>0)/4294967296}function KX(J){return J*V6}function UX(J){return J*F9}function GX(J){return(J&J-1)===0&&J!==0}function qX(J){return Math.pow(2,Math.ceil(Math.log(J)/Math.LN2))}function EX(J){return Math.pow(2,Math.floor(Math.log(J)/Math.LN2))}function NX(J,Q,$,Z,W){let{cos:H,sin:Y}=Math,X=H($/2),K=Y($/2),U=H((Q+Z)/2),G=Y((Q+Z)/2),q=H((Q-Z)/2),E=Y((Q-Z)/2),O=H((Z-Q)/2),D=Y((Z-Q)/2);switch(W){case"XYX":J.set(X*G,K*q,K*E,X*U);break;case"YZY":J.set(K*E,X*G,K*q,X*U);break;case"ZXZ":J.set(K*q,K*E,X*G,X*U);break;case"XZX":J.set(X*G,K*D,K*O,X*U);break;case"YXY":J.set(K*O,X*G,K*D,X*U);break;case"ZYZ":J.set(K*D,K*O,X*G,X*U);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+W)}}function U8(J,Q){switch(Q.constructor){case Float32Array:return J;case Uint32Array:return J/4294967295;case Uint16Array:return J/65535;case Uint8Array:return J/255;case Int32Array:return Math.max(J/2147483647,-1);case Int16Array:return Math.max(J/32767,-1);case Int8Array:return Math.max(J/127,-1);default:throw Error("Invalid component type.")}}function e0(J,Q){switch(Q.constructor){case Float32Array:return J;case Uint32Array:return Math.round(J*4294967295);case Uint16Array:return Math.round(J*65535);case Uint8Array:return Math.round(J*255);case Int32Array:return Math.round(J*2147483647);case Int16Array:return Math.round(J*32767);case Int8Array:return Math.round(J*127);default:throw Error("Invalid component type.")}}var cJ={DEG2RAD:V6,RAD2DEG:F9,generateUUID:G8,clamp:d0,euclideanModulo:g$,mapLinear:tY,inverseLerp:eY,lerp:z6,damp:JX,pingpong:QX,smoothstep:$X,smootherstep:ZX,randInt:WX,randFloat:HX,randFloatSpread:YX,seededRandom:XX,degToRad:KX,radToDeg:UX,isPowerOfTwo:GX,ceilPowerOfTwo:qX,floorPowerOfTwo:EX,setQuaternionFromProperEuler:NX,normalize:e0,denormalize:U8};class _0{constructor(J=0,Q=0){_0.prototype.isVector2=!0,this.x=J,this.y=Q}get width(){return this.x}set width(J){this.x=J}get height(){return this.y}set height(J){this.y=J}set(J,Q){return this.x=J,this.y=Q,this}setScalar(J){return this.x=J,this.y=J,this}setX(J){return this.x=J,this}setY(J){return this.y=J,this}setComponent(J,Q){switch(J){case 0:this.x=Q;break;case 1:this.y=Q;break;default:throw Error("index is out of range: "+J)}return this}getComponent(J){switch(J){case 0:return this.x;case 1:return this.y;default:throw Error("index is out of range: "+J)}}clone(){return new this.constructor(this.x,this.y)}copy(J){return this.x=J.x,this.y=J.y,this}add(J){return this.x+=J.x,this.y+=J.y,this}addScalar(J){return this.x+=J,this.y+=J,this}addVectors(J,Q){return this.x=J.x+Q.x,this.y=J.y+Q.y,this}addScaledVector(J,Q){return this.x+=J.x*Q,this.y+=J.y*Q,this}sub(J){return this.x-=J.x,this.y-=J.y,this}subScalar(J){return this.x-=J,this.y-=J,this}subVectors(J,Q){return this.x=J.x-Q.x,this.y=J.y-Q.y,this}multiply(J){return this.x*=J.x,this.y*=J.y,this}multiplyScalar(J){return this.x*=J,this.y*=J,this}divide(J){return this.x/=J.x,this.y/=J.y,this}divideScalar(J){return this.multiplyScalar(1/J)}applyMatrix3(J){let Q=this.x,$=this.y,Z=J.elements;return this.x=Z[0]*Q+Z[3]*$+Z[6],this.y=Z[1]*Q+Z[4]*$+Z[7],this}min(J){return this.x=Math.min(this.x,J.x),this.y=Math.min(this.y,J.y),this}max(J){return this.x=Math.max(this.x,J.x),this.y=Math.max(this.y,J.y),this}clamp(J,Q){return this.x=d0(this.x,J.x,Q.x),this.y=d0(this.y,J.y,Q.y),this}clampScalar(J,Q){return this.x=d0(this.x,J,Q),this.y=d0(this.y,J,Q),this}clampLength(J,Q){let $=this.length();return this.divideScalar($||1).multiplyScalar(d0($,J,Q))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(J){return this.x*J.x+this.y*J.y}cross(J){return this.x*J.y-this.y*J.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(J){let Q=Math.sqrt(this.lengthSq()*J.lengthSq());if(Q===0)return Math.PI/2;let $=this.dot(J)/Q;return Math.acos(d0($,-1,1))}distanceTo(J){return Math.sqrt(this.distanceToSquared(J))}distanceToSquared(J){let Q=this.x-J.x,$=this.y-J.y;return Q*Q+$*$}manhattanDistanceTo(J){return Math.abs(this.x-J.x)+Math.abs(this.y-J.y)}setLength(J){return this.normalize().multiplyScalar(J)}lerp(J,Q){return this.x+=(J.x-this.x)*Q,this.y+=(J.y-this.y)*Q,this}lerpVectors(J,Q,$){return this.x=J.x+(Q.x-J.x)*$,this.y=J.y+(Q.y-J.y)*$,this}equals(J){return J.x===this.x&&J.y===this.y}fromArray(J,Q=0){return this.x=J[Q],this.y=J[Q+1],this}toArray(J=[],Q=0){return J[Q]=this.x,J[Q+1]=this.y,J}fromBufferAttribute(J,Q){return this.x=J.getX(Q),this.y=J.getY(Q),this}rotateAround(J,Q){let $=Math.cos(Q),Z=Math.sin(Q),W=this.x-J.x,H=this.y-J.y;return this.x=W*$-H*Z+J.x,this.y=W*Z+H*$+J.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class jJ{constructor(J=0,Q=0,$=0,Z=1){this.isQuaternion=!0,this._x=J,this._y=Q,this._z=$,this._w=Z}static slerpFlat(J,Q,$,Z,W,H,Y){let X=$[Z+0],K=$[Z+1],U=$[Z+2],G=$[Z+3],q=W[H+0],E=W[H+1],O=W[H+2],D=W[H+3];if(Y===0){J[Q+0]=X,J[Q+1]=K,J[Q+2]=U,J[Q+3]=G;return}if(Y===1){J[Q+0]=q,J[Q+1]=E,J[Q+2]=O,J[Q+3]=D;return}if(G!==D||X!==q||K!==E||U!==O){let k=1-Y,N=X*q+K*E+U*O+G*D,F=N>=0?1:-1,C=1-N*N;if(C>Number.EPSILON){let _=Math.sqrt(C),j=Math.atan2(_,N*F);k=Math.sin(k*j)/_,Y=Math.sin(Y*j)/_}let L=Y*F;if(X=X*k+q*L,K=K*k+E*L,U=U*k+O*L,G=G*k+D*L,k===1-Y){let _=1/Math.sqrt(X*X+K*K+U*U+G*G);X*=_,K*=_,U*=_,G*=_}}J[Q]=X,J[Q+1]=K,J[Q+2]=U,J[Q+3]=G}static multiplyQuaternionsFlat(J,Q,$,Z,W,H){let Y=$[Z],X=$[Z+1],K=$[Z+2],U=$[Z+3],G=W[H],q=W[H+1],E=W[H+2],O=W[H+3];return J[Q]=Y*O+U*G+X*E-K*q,J[Q+1]=X*O+U*q+K*G-Y*E,J[Q+2]=K*O+U*E+Y*q-X*G,J[Q+3]=U*O-Y*G-X*q-K*E,J}get x(){return this._x}set x(J){this._x=J,this._onChangeCallback()}get y(){return this._y}set y(J){this._y=J,this._onChangeCallback()}get z(){return this._z}set z(J){this._z=J,this._onChangeCallback()}get w(){return this._w}set w(J){this._w=J,this._onChangeCallback()}set(J,Q,$,Z){return this._x=J,this._y=Q,this._z=$,this._w=Z,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(J){return this._x=J.x,this._y=J.y,this._z=J.z,this._w=J.w,this._onChangeCallback(),this}setFromEuler(J,Q=!0){let{_x:$,_y:Z,_z:W,_order:H}=J,Y=Math.cos,X=Math.sin,K=Y($/2),U=Y(Z/2),G=Y(W/2),q=X($/2),E=X(Z/2),O=X(W/2);switch(H){case"XYZ":this._x=q*U*G+K*E*O,this._y=K*E*G-q*U*O,this._z=K*U*O+q*E*G,this._w=K*U*G-q*E*O;break;case"YXZ":this._x=q*U*G+K*E*O,this._y=K*E*G-q*U*O,this._z=K*U*O-q*E*G,this._w=K*U*G+q*E*O;break;case"ZXY":this._x=q*U*G-K*E*O,this._y=K*E*G+q*U*O,this._z=K*U*O+q*E*G,this._w=K*U*G-q*E*O;break;case"ZYX":this._x=q*U*G-K*E*O,this._y=K*E*G+q*U*O,this._z=K*U*O-q*E*G,this._w=K*U*G+q*E*O;break;case"YZX":this._x=q*U*G+K*E*O,this._y=K*E*G+q*U*O,this._z=K*U*O-q*E*G,this._w=K*U*G-q*E*O;break;case"XZY":this._x=q*U*G-K*E*O,this._y=K*E*G-q*U*O,this._z=K*U*O+q*E*G,this._w=K*U*G+q*E*O;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+H)}if(Q===!0)this._onChangeCallback();return this}setFromAxisAngle(J,Q){let $=Q/2,Z=Math.sin($);return this._x=J.x*Z,this._y=J.y*Z,this._z=J.z*Z,this._w=Math.cos($),this._onChangeCallback(),this}setFromRotationMatrix(J){let Q=J.elements,$=Q[0],Z=Q[4],W=Q[8],H=Q[1],Y=Q[5],X=Q[9],K=Q[2],U=Q[6],G=Q[10],q=$+Y+G;if(q>0){let E=0.5/Math.sqrt(q+1);this._w=0.25/E,this._x=(U-X)*E,this._y=(W-K)*E,this._z=(H-Z)*E}else if($>Y&&$>G){let E=2*Math.sqrt(1+$-Y-G);this._w=(U-X)/E,this._x=0.25*E,this._y=(Z+H)/E,this._z=(W+K)/E}else if(Y>G){let E=2*Math.sqrt(1+Y-$-G);this._w=(W-K)/E,this._x=(Z+H)/E,this._y=0.25*E,this._z=(X+U)/E}else{let E=2*Math.sqrt(1+G-$-Y);this._w=(H-Z)/E,this._x=(W+K)/E,this._y=(X+U)/E,this._z=0.25*E}return this._onChangeCallback(),this}setFromUnitVectors(J,Q){let $=J.dot(Q)+1;if($<0.00000001)if($=0,Math.abs(J.x)>Math.abs(J.z))this._x=-J.y,this._y=J.x,this._z=0,this._w=$;else this._x=0,this._y=-J.z,this._z=J.y,this._w=$;else this._x=J.y*Q.z-J.z*Q.y,this._y=J.z*Q.x-J.x*Q.z,this._z=J.x*Q.y-J.y*Q.x,this._w=$;return this.normalize()}angleTo(J){return 2*Math.acos(Math.abs(d0(this.dot(J),-1,1)))}rotateTowards(J,Q){let $=this.angleTo(J);if($===0)return this;let Z=Math.min(1,Q/$);return this.slerp(J,Z),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(J){return this._x*J._x+this._y*J._y+this._z*J._z+this._w*J._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let J=this.length();if(J===0)this._x=0,this._y=0,this._z=0,this._w=1;else J=1/J,this._x=this._x*J,this._y=this._y*J,this._z=this._z*J,this._w=this._w*J;return this._onChangeCallback(),this}multiply(J){return this.multiplyQuaternions(this,J)}premultiply(J){return this.multiplyQuaternions(J,this)}multiplyQuaternions(J,Q){let{_x:$,_y:Z,_z:W,_w:H}=J,Y=Q._x,X=Q._y,K=Q._z,U=Q._w;return this._x=$*U+H*Y+Z*K-W*X,this._y=Z*U+H*X+W*Y-$*K,this._z=W*U+H*K+$*X-Z*Y,this._w=H*U-$*Y-Z*X-W*K,this._onChangeCallback(),this}slerp(J,Q){if(Q===0)return this;if(Q===1)return this.copy(J);let $=this._x,Z=this._y,W=this._z,H=this._w,Y=H*J._w+$*J._x+Z*J._y+W*J._z;if(Y<0)this._w=-J._w,this._x=-J._x,this._y=-J._y,this._z=-J._z,Y=-Y;else this.copy(J);if(Y>=1)return this._w=H,this._x=$,this._y=Z,this._z=W,this;let X=1-Y*Y;if(X<=Number.EPSILON){let E=1-Q;return this._w=E*H+Q*this._w,this._x=E*$+Q*this._x,this._y=E*Z+Q*this._y,this._z=E*W+Q*this._z,this.normalize(),this}let K=Math.sqrt(X),U=Math.atan2(K,Y),G=Math.sin((1-Q)*U)/K,q=Math.sin(Q*U)/K;return this._w=H*G+this._w*q,this._x=$*G+this._x*q,this._y=Z*G+this._y*q,this._z=W*G+this._z*q,this._onChangeCallback(),this}slerpQuaternions(J,Q,$){return this.copy(J).slerp(Q,$)}random(){let J=2*Math.PI*Math.random(),Q=2*Math.PI*Math.random(),$=Math.random(),Z=Math.sqrt(1-$),W=Math.sqrt($);return this.set(Z*Math.sin(J),Z*Math.cos(J),W*Math.sin(Q),W*Math.cos(Q))}equals(J){return J._x===this._x&&J._y===this._y&&J._z===this._z&&J._w===this._w}fromArray(J,Q=0){return this._x=J[Q],this._y=J[Q+1],this._z=J[Q+2],this._w=J[Q+3],this._onChangeCallback(),this}toArray(J=[],Q=0){return J[Q]=this._x,J[Q+1]=this._y,J[Q+2]=this._z,J[Q+3]=this._w,J}fromBufferAttribute(J,Q){return this._x=J.getX(Q),this._y=J.getY(Q),this._z=J.getZ(Q),this._w=J.getW(Q),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(J){return this._onChangeCallback=J,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class P{constructor(J=0,Q=0,$=0){P.prototype.isVector3=!0,this.x=J,this.y=Q,this.z=$}set(J,Q,$){if($===void 0)$=this.z;return this.x=J,this.y=Q,this.z=$,this}setScalar(J){return this.x=J,this.y=J,this.z=J,this}setX(J){return this.x=J,this}setY(J){return this.y=J,this}setZ(J){return this.z=J,this}setComponent(J,Q){switch(J){case 0:this.x=Q;break;case 1:this.y=Q;break;case 2:this.z=Q;break;default:throw Error("index is out of range: "+J)}return this}getComponent(J){switch(J){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw Error("index is out of range: "+J)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(J){return this.x=J.x,this.y=J.y,this.z=J.z,this}add(J){return this.x+=J.x,this.y+=J.y,this.z+=J.z,this}addScalar(J){return this.x+=J,this.y+=J,this.z+=J,this}addVectors(J,Q){return this.x=J.x+Q.x,this.y=J.y+Q.y,this.z=J.z+Q.z,this}addScaledVector(J,Q){return this.x+=J.x*Q,this.y+=J.y*Q,this.z+=J.z*Q,this}sub(J){return this.x-=J.x,this.y-=J.y,this.z-=J.z,this}subScalar(J){return this.x-=J,this.y-=J,this.z-=J,this}subVectors(J,Q){return this.x=J.x-Q.x,this.y=J.y-Q.y,this.z=J.z-Q.z,this}multiply(J){return this.x*=J.x,this.y*=J.y,this.z*=J.z,this}multiplyScalar(J){return this.x*=J,this.y*=J,this.z*=J,this}multiplyVectors(J,Q){return this.x=J.x*Q.x,this.y=J.y*Q.y,this.z=J.z*Q.z,this}applyEuler(J){return this.applyQuaternion(yZ.setFromEuler(J))}applyAxisAngle(J,Q){return this.applyQuaternion(yZ.setFromAxisAngle(J,Q))}applyMatrix3(J){let Q=this.x,$=this.y,Z=this.z,W=J.elements;return this.x=W[0]*Q+W[3]*$+W[6]*Z,this.y=W[1]*Q+W[4]*$+W[7]*Z,this.z=W[2]*Q+W[5]*$+W[8]*Z,this}applyNormalMatrix(J){return this.applyMatrix3(J).normalize()}applyMatrix4(J){let Q=this.x,$=this.y,Z=this.z,W=J.elements,H=1/(W[3]*Q+W[7]*$+W[11]*Z+W[15]);return this.x=(W[0]*Q+W[4]*$+W[8]*Z+W[12])*H,this.y=(W[1]*Q+W[5]*$+W[9]*Z+W[13])*H,this.z=(W[2]*Q+W[6]*$+W[10]*Z+W[14])*H,this}applyQuaternion(J){let Q=this.x,$=this.y,Z=this.z,W=J.x,H=J.y,Y=J.z,X=J.w,K=2*(H*Z-Y*$),U=2*(Y*Q-W*Z),G=2*(W*$-H*Q);return this.x=Q+X*K+H*G-Y*U,this.y=$+X*U+Y*K-W*G,this.z=Z+X*G+W*U-H*K,this}project(J){return this.applyMatrix4(J.matrixWorldInverse).applyMatrix4(J.projectionMatrix)}unproject(J){return this.applyMatrix4(J.projectionMatrixInverse).applyMatrix4(J.matrixWorld)}transformDirection(J){let Q=this.x,$=this.y,Z=this.z,W=J.elements;return this.x=W[0]*Q+W[4]*$+W[8]*Z,this.y=W[1]*Q+W[5]*$+W[9]*Z,this.z=W[2]*Q+W[6]*$+W[10]*Z,this.normalize()}divide(J){return this.x/=J.x,this.y/=J.y,this.z/=J.z,this}divideScalar(J){return this.multiplyScalar(1/J)}min(J){return this.x=Math.min(this.x,J.x),this.y=Math.min(this.y,J.y),this.z=Math.min(this.z,J.z),this}max(J){return this.x=Math.max(this.x,J.x),this.y=Math.max(this.y,J.y),this.z=Math.max(this.z,J.z),this}clamp(J,Q){return this.x=d0(this.x,J.x,Q.x),this.y=d0(this.y,J.y,Q.y),this.z=d0(this.z,J.z,Q.z),this}clampScalar(J,Q){return this.x=d0(this.x,J,Q),this.y=d0(this.y,J,Q),this.z=d0(this.z,J,Q),this}clampLength(J,Q){let $=this.length();return this.divideScalar($||1).multiplyScalar(d0($,J,Q))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(J){return this.x*J.x+this.y*J.y+this.z*J.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(J){return this.normalize().multiplyScalar(J)}lerp(J,Q){return this.x+=(J.x-this.x)*Q,this.y+=(J.y-this.y)*Q,this.z+=(J.z-this.z)*Q,this}lerpVectors(J,Q,$){return this.x=J.x+(Q.x-J.x)*$,this.y=J.y+(Q.y-J.y)*$,this.z=J.z+(Q.z-J.z)*$,this}cross(J){return this.crossVectors(this,J)}crossVectors(J,Q){let{x:$,y:Z,z:W}=J,H=Q.x,Y=Q.y,X=Q.z;return this.x=Z*X-W*Y,this.y=W*H-$*X,this.z=$*Y-Z*H,this}projectOnVector(J){let Q=J.lengthSq();if(Q===0)return this.set(0,0,0);let $=J.dot(this)/Q;return this.copy(J).multiplyScalar($)}projectOnPlane(J){return MQ.copy(this).projectOnVector(J),this.sub(MQ)}reflect(J){return this.sub(MQ.copy(J).multiplyScalar(2*this.dot(J)))}angleTo(J){let Q=Math.sqrt(this.lengthSq()*J.lengthSq());if(Q===0)return Math.PI/2;let $=this.dot(J)/Q;return Math.acos(d0($,-1,1))}distanceTo(J){return Math.sqrt(this.distanceToSquared(J))}distanceToSquared(J){let Q=this.x-J.x,$=this.y-J.y,Z=this.z-J.z;return Q*Q+$*$+Z*Z}manhattanDistanceTo(J){return Math.abs(this.x-J.x)+Math.abs(this.y-J.y)+Math.abs(this.z-J.z)}setFromSpherical(J){return this.setFromSphericalCoords(J.radius,J.phi,J.theta)}setFromSphericalCoords(J,Q,$){let Z=Math.sin(Q)*J;return this.x=Z*Math.sin($),this.y=Math.cos(Q)*J,this.z=Z*Math.cos($),this}setFromCylindrical(J){return this.setFromCylindricalCoords(J.radius,J.theta,J.y)}setFromCylindricalCoords(J,Q,$){return this.x=J*Math.sin(Q),this.y=$,this.z=J*Math.cos(Q),this}setFromMatrixPosition(J){let Q=J.elements;return this.x=Q[12],this.y=Q[13],this.z=Q[14],this}setFromMatrixScale(J){let Q=this.setFromMatrixColumn(J,0).length(),$=this.setFromMatrixColumn(J,1).length(),Z=this.setFromMatrixColumn(J,2).length();return this.x=Q,this.y=$,this.z=Z,this}setFromMatrixColumn(J,Q){return this.fromArray(J.elements,Q*4)}setFromMatrix3Column(J,Q){return this.fromArray(J.elements,Q*3)}setFromEuler(J){return this.x=J._x,this.y=J._y,this.z=J._z,this}setFromColor(J){return this.x=J.r,this.y=J.g,this.z=J.b,this}equals(J){return J.x===this.x&&J.y===this.y&&J.z===this.z}fromArray(J,Q=0){return this.x=J[Q],this.y=J[Q+1],this.z=J[Q+2],this}toArray(J=[],Q=0){return J[Q]=this.x,J[Q+1]=this.y,J[Q+2]=this.z,J}fromBufferAttribute(J,Q){return this.x=J.getX(Q),this.y=J.getY(Q),this.z=J.getZ(Q),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let J=Math.random()*Math.PI*2,Q=Math.random()*2-1,$=Math.sqrt(1-Q*Q);return this.x=$*Math.cos(J),this.y=Q,this.z=$*Math.sin(J),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}var MQ=new P,yZ=new jJ;class f0{constructor(J,Q,$,Z,W,H,Y,X,K){if(f0.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],J!==void 0)this.set(J,Q,$,Z,W,H,Y,X,K)}set(J,Q,$,Z,W,H,Y,X,K){let U=this.elements;return U[0]=J,U[1]=Z,U[2]=Y,U[3]=Q,U[4]=W,U[5]=X,U[6]=$,U[7]=H,U[8]=K,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(J){let Q=this.elements,$=J.elements;return Q[0]=$[0],Q[1]=$[1],Q[2]=$[2],Q[3]=$[3],Q[4]=$[4],Q[5]=$[5],Q[6]=$[6],Q[7]=$[7],Q[8]=$[8],this}extractBasis(J,Q,$){return J.setFromMatrix3Column(this,0),Q.setFromMatrix3Column(this,1),$.setFromMatrix3Column(this,2),this}setFromMatrix4(J){let Q=J.elements;return this.set(Q[0],Q[4],Q[8],Q[1],Q[5],Q[9],Q[2],Q[6],Q[10]),this}multiply(J){return this.multiplyMatrices(this,J)}premultiply(J){return this.multiplyMatrices(J,this)}multiplyMatrices(J,Q){let $=J.elements,Z=Q.elements,W=this.elements,H=$[0],Y=$[3],X=$[6],K=$[1],U=$[4],G=$[7],q=$[2],E=$[5],O=$[8],D=Z[0],k=Z[3],N=Z[6],F=Z[1],C=Z[4],L=Z[7],_=Z[2],j=Z[5],w=Z[8];return W[0]=H*D+Y*F+X*_,W[3]=H*k+Y*C+X*j,W[6]=H*N+Y*L+X*w,W[1]=K*D+U*F+G*_,W[4]=K*k+U*C+G*j,W[7]=K*N+U*L+G*w,W[2]=q*D+E*F+O*_,W[5]=q*k+E*C+O*j,W[8]=q*N+E*L+O*w,this}multiplyScalar(J){let Q=this.elements;return Q[0]*=J,Q[3]*=J,Q[6]*=J,Q[1]*=J,Q[4]*=J,Q[7]*=J,Q[2]*=J,Q[5]*=J,Q[8]*=J,this}determinant(){let J=this.elements,Q=J[0],$=J[1],Z=J[2],W=J[3],H=J[4],Y=J[5],X=J[6],K=J[7],U=J[8];return Q*H*U-Q*Y*K-$*W*U+$*Y*X+Z*W*K-Z*H*X}invert(){let J=this.elements,Q=J[0],$=J[1],Z=J[2],W=J[3],H=J[4],Y=J[5],X=J[6],K=J[7],U=J[8],G=U*H-Y*K,q=Y*X-U*W,E=K*W-H*X,O=Q*G+$*q+Z*E;if(O===0)return this.set(0,0,0,0,0,0,0,0,0);let D=1/O;return J[0]=G*D,J[1]=(Z*K-U*$)*D,J[2]=(Y*$-Z*H)*D,J[3]=q*D,J[4]=(U*Q-Z*X)*D,J[5]=(Z*W-Y*Q)*D,J[6]=E*D,J[7]=($*X-K*Q)*D,J[8]=(H*Q-$*W)*D,this}transpose(){let J,Q=this.elements;return J=Q[1],Q[1]=Q[3],Q[3]=J,J=Q[2],Q[2]=Q[6],Q[6]=J,J=Q[5],Q[5]=Q[7],Q[7]=J,this}getNormalMatrix(J){return this.setFromMatrix4(J).invert().transpose()}transposeIntoArray(J){let Q=this.elements;return J[0]=Q[0],J[1]=Q[3],J[2]=Q[6],J[3]=Q[1],J[4]=Q[4],J[5]=Q[7],J[6]=Q[2],J[7]=Q[5],J[8]=Q[8],this}setUvTransform(J,Q,$,Z,W,H,Y){let X=Math.cos(W),K=Math.sin(W);return this.set($*X,$*K,-$*(X*H+K*Y)+H+J,-Z*K,Z*X,-Z*(-K*H+X*Y)+Y+Q,0,0,1),this}scale(J,Q){return this.premultiply(LQ.makeScale(J,Q)),this}rotate(J){return this.premultiply(LQ.makeRotation(-J)),this}translate(J,Q){return this.premultiply(LQ.makeTranslation(J,Q)),this}makeTranslation(J,Q){if(J.isVector2)this.set(1,0,J.x,0,1,J.y,0,0,1);else this.set(1,0,J,0,1,Q,0,0,1);return this}makeRotation(J){let Q=Math.cos(J),$=Math.sin(J);return this.set(Q,-$,0,$,Q,0,0,0,1),this}makeScale(J,Q){return this.set(J,0,0,0,Q,0,0,0,1),this}equals(J){let Q=this.elements,$=J.elements;for(let Z=0;Z<9;Z++)if(Q[Z]!==$[Z])return!1;return!0}fromArray(J,Q=0){for(let $=0;$<9;$++)this.elements[$]=J[$+Q];return this}toArray(J=[],Q=0){let $=this.elements;return J[Q]=$[0],J[Q+1]=$[1],J[Q+2]=$[2],J[Q+3]=$[3],J[Q+4]=$[4],J[Q+5]=$[5],J[Q+6]=$[6],J[Q+7]=$[7],J[Q+8]=$[8],J}clone(){return new this.constructor().fromArray(this.elements)}}var LQ=new f0;function p$(J){for(let Q=J.length-1;Q>=0;--Q)if(J[Q]>=65535)return!0;return!1}function s9(J){return document.createElementNS("http://www.w3.org/1999/xhtml",J)}function EH(){let J=s9("canvas");return J.style.display="block",J}var vZ={};function o9(J){if(J in vZ)return;vZ[J]=!0,console.warn(J)}function NH(J,Q,$){return new Promise(function(Z,W){function H(){switch(J.clientWaitSync(Q,J.SYNC_FLUSH_COMMANDS_BIT,0)){case J.WAIT_FAILED:W();break;case J.TIMEOUT_EXPIRED:setTimeout(H,$);break;default:Z()}}setTimeout(H,$)})}var fZ=new f0().set(0.4123908,0.3575843,0.1804808,0.212639,0.7151687,0.0721923,0.0193308,0.1191948,0.9505322),hZ=new f0().set(3.2409699,-1.5373832,-0.4986108,-0.9692436,1.8759675,0.0415551,0.0556301,-0.203977,1.0569715);function FX(){let J={enabled:!0,workingColorSpace:"srgb-linear",spaces:{},convert:function(W,H,Y){if(this.enabled===!1||H===Y||!H||!Y)return W;if(this.spaces[H].transfer==="srgb")W.r=S8(W.r),W.g=S8(W.g),W.b=S8(W.b);if(this.spaces[H].primaries!==this.spaces[Y].primaries)W.applyMatrix3(this.spaces[H].toXYZ),W.applyMatrix3(this.spaces[Y].fromXYZ);if(this.spaces[Y].transfer==="srgb")W.r=n9(W.r),W.g=n9(W.g),W.b=n9(W.b);return W},workingToColorSpace:function(W,H){return this.convert(W,this.workingColorSpace,H)},colorSpaceToWorking:function(W,H){return this.convert(W,H,this.workingColorSpace)},getPrimaries:function(W){return this.spaces[W].primaries},getTransfer:function(W){if(W==="")return"linear";return this.spaces[W].transfer},getToneMappingMode:function(W){return this.spaces[W].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(W,H=this.workingColorSpace){return W.fromArray(this.spaces[H].luminanceCoefficients)},define:function(W){Object.assign(this.spaces,W)},_getMatrix:function(W,H,Y){return W.copy(this.spaces[H].toXYZ).multiply(this.spaces[Y].fromXYZ)},_getDrawingBufferColorSpace:function(W){return this.spaces[W].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(W=this.workingColorSpace){return this.spaces[W].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(W,H){return o9("THREE.ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),J.workingToColorSpace(W,H)},toWorkingColorSpace:function(W,H){return o9("THREE.ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),J.colorSpaceToWorking(W,H)}},Q=[0.64,0.33,0.3,0.6,0.15,0.06],$=[0.2126,0.7152,0.0722],Z=[0.3127,0.329];return J.define({["srgb-linear"]:{primaries:Q,whitePoint:Z,transfer:"linear",toXYZ:fZ,fromXYZ:hZ,luminanceCoefficients:$,workingColorSpaceConfig:{unpackColorSpace:"srgb"},outputColorSpaceConfig:{drawingBufferColorSpace:"srgb"}},["srgb"]:{primaries:Q,whitePoint:Z,transfer:"srgb",toXYZ:fZ,fromXYZ:hZ,luminanceCoefficients:$,outputColorSpaceConfig:{drawingBufferColorSpace:"srgb"}}}),J}var n0=FX();function S8(J){return J<0.04045?J*0.0773993808:Math.pow(J*0.9478672986+0.0521327014,2.4)}function n9(J){return J<0.0031308?J*12.92:1.055*Math.pow(J,0.41666)-0.055}var j9;class l${static getDataURL(J,Q="image/png"){if(/^data:/i.test(J.src))return J.src;if(typeof HTMLCanvasElement>"u")return J.src;let $;if(J instanceof HTMLCanvasElement)$=J;else{if(j9===void 0)j9=s9("canvas");j9.width=J.width,j9.height=J.height;let Z=j9.getContext("2d");if(J instanceof ImageData)Z.putImageData(J,0,0);else Z.drawImage(J,0,0,J.width,J.height);$=j9}return $.toDataURL(Q)}static sRGBToLinear(J){if(typeof HTMLImageElement<"u"&&J instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&J instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&J instanceof ImageBitmap){let Q=s9("canvas");Q.width=J.width,Q.height=J.height;let $=Q.getContext("2d");$.drawImage(J,0,0,J.width,J.height);let Z=$.getImageData(0,0,J.width,J.height),W=Z.data;for(let H=0;H<W.length;H++)W[H]=S8(W[H]/255)*255;return $.putImageData(Z,0,0),Q}else if(J.data){let Q=J.data.slice(0);for(let $=0;$<Q.length;$++)if(Q instanceof Uint8Array||Q instanceof Uint8ClampedArray)Q[$]=Math.floor(S8(Q[$]/255)*255);else Q[$]=S8(Q[$]);return{data:Q,width:J.width,height:J.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),J}}var OX=0;class A6{constructor(J=null){this.isSource=!0,Object.defineProperty(this,"id",{value:OX++}),this.uuid=G8(),this.data=J,this.dataReady=!0,this.version=0}getSize(J){let Q=this.data;if(typeof HTMLVideoElement<"u"&&Q instanceof HTMLVideoElement)J.set(Q.videoWidth,Q.videoHeight,0);else if(Q instanceof VideoFrame)J.set(Q.displayHeight,Q.displayWidth,0);else if(Q!==null)J.set(Q.width,Q.height,Q.depth||0);else J.set(0,0,0);return J}set needsUpdate(J){if(J===!0)this.version++}toJSON(J){let Q=J===void 0||typeof J==="string";if(!Q&&J.images[this.uuid]!==void 0)return J.images[this.uuid];let $={uuid:this.uuid,url:""},Z=this.data;if(Z!==null){let W;if(Array.isArray(Z)){W=[];for(let H=0,Y=Z.length;H<Y;H++)if(Z[H].isDataTexture)W.push(VQ(Z[H].image));else W.push(VQ(Z[H]))}else W=VQ(Z);$.url=W}if(!Q)J.images[this.uuid]=$;return $}}function VQ(J){if(typeof HTMLImageElement<"u"&&J instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&J instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&J instanceof ImageBitmap)return l$.getDataURL(J);else if(J.data)return{data:Array.from(J.data),width:J.width,height:J.height,type:J.data.constructor.name};else return console.warn("THREE.Texture: Unable to serialize Texture."),{}}var RX=0,zQ=new P;class kJ extends x8{constructor(J=kJ.DEFAULT_IMAGE,Q=kJ.DEFAULT_MAPPING,$=1001,Z=1001,W=1006,H=1008,Y=1023,X=1009,K=kJ.DEFAULT_ANISOTROPY,U=""){super();this.isTexture=!0,Object.defineProperty(this,"id",{value:RX++}),this.uuid=G8(),this.name="",this.source=new A6(J),this.mipmaps=[],this.mapping=Q,this.channel=0,this.wrapS=$,this.wrapT=Z,this.magFilter=W,this.minFilter=H,this.anisotropy=K,this.format=Y,this.internalFormat=null,this.type=X,this.offset=new _0(0,0),this.repeat=new _0(1,1),this.center=new _0(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new f0,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=U,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=J&&J.depth&&J.depth>1?!0:!1,this.pmremVersion=0}get width(){return this.source.getSize(zQ).x}get height(){return this.source.getSize(zQ).y}get depth(){return this.source.getSize(zQ).z}get image(){return this.source.data}set image(J=null){this.source.data=J}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(J,Q){this.updateRanges.push({start:J,count:Q})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(J){return this.name=J.name,this.source=J.source,this.mipmaps=J.mipmaps.slice(0),this.mapping=J.mapping,this.channel=J.channel,this.wrapS=J.wrapS,this.wrapT=J.wrapT,this.magFilter=J.magFilter,this.minFilter=J.minFilter,this.anisotropy=J.anisotropy,this.format=J.format,this.internalFormat=J.internalFormat,this.type=J.type,this.offset.copy(J.offset),this.repeat.copy(J.repeat),this.center.copy(J.center),this.rotation=J.rotation,this.matrixAutoUpdate=J.matrixAutoUpdate,this.matrix.copy(J.matrix),this.generateMipmaps=J.generateMipmaps,this.premultiplyAlpha=J.premultiplyAlpha,this.flipY=J.flipY,this.unpackAlignment=J.unpackAlignment,this.colorSpace=J.colorSpace,this.renderTarget=J.renderTarget,this.isRenderTargetTexture=J.isRenderTargetTexture,this.isArrayTexture=J.isArrayTexture,this.userData=JSON.parse(JSON.stringify(J.userData)),this.needsUpdate=!0,this}setValues(J){for(let Q in J){let $=J[Q];if($===void 0){console.warn(`THREE.Texture.setValues(): parameter '${Q}' has value of undefined.`);continue}let Z=this[Q];if(Z===void 0){console.warn(`THREE.Texture.setValues(): property '${Q}' does not exist.`);continue}if(Z&&$&&(Z.isVector2&&$.isVector2))Z.copy($);else if(Z&&$&&(Z.isVector3&&$.isVector3))Z.copy($);else if(Z&&$&&(Z.isMatrix3&&$.isMatrix3))Z.copy($);else this[Q]=$}}toJSON(J){let Q=J===void 0||typeof J==="string";if(!Q&&J.textures[this.uuid]!==void 0)return J.textures[this.uuid];let $={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(J).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};if(Object.keys(this.userData).length>0)$.userData=this.userData;if(!Q)J.textures[this.uuid]=$;return $}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(J){if(this.mapping!==300)return J;if(J.applyMatrix3(this.matrix),J.x<0||J.x>1)switch(this.wrapS){case 1000:J.x=J.x-Math.floor(J.x);break;case 1001:J.x=J.x<0?0:1;break;case 1002:if(Math.abs(Math.floor(J.x)%2)===1)J.x=Math.ceil(J.x)-J.x;else J.x=J.x-Math.floor(J.x);break}if(J.y<0||J.y>1)switch(this.wrapT){case 1000:J.y=J.y-Math.floor(J.y);break;case 1001:J.y=J.y<0?0:1;break;case 1002:if(Math.abs(Math.floor(J.y)%2)===1)J.y=Math.ceil(J.y)-J.y;else J.y=J.y-Math.floor(J.y);break}if(this.flipY)J.y=1-J.y;return J}set needsUpdate(J){if(J===!0)this.version++,this.source.needsUpdate=!0}set needsPMREMUpdate(J){if(J===!0)this.pmremVersion++}}kJ.DEFAULT_IMAGE=null;kJ.DEFAULT_MAPPING=300;kJ.DEFAULT_ANISOTROPY=1;class a0{constructor(J=0,Q=0,$=0,Z=1){a0.prototype.isVector4=!0,this.x=J,this.y=Q,this.z=$,this.w=Z}get width(){return this.z}set width(J){this.z=J}get height(){return this.w}set height(J){this.w=J}set(J,Q,$,Z){return this.x=J,this.y=Q,this.z=$,this.w=Z,this}setScalar(J){return this.x=J,this.y=J,this.z=J,this.w=J,this}setX(J){return this.x=J,this}setY(J){return this.y=J,this}setZ(J){return this.z=J,this}setW(J){return this.w=J,this}setComponent(J,Q){switch(J){case 0:this.x=Q;break;case 1:this.y=Q;break;case 2:this.z=Q;break;case 3:this.w=Q;break;default:throw Error("index is out of range: "+J)}return this}getComponent(J){switch(J){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw Error("index is out of range: "+J)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(J){return this.x=J.x,this.y=J.y,this.z=J.z,this.w=J.w!==void 0?J.w:1,this}add(J){return this.x+=J.x,this.y+=J.y,this.z+=J.z,this.w+=J.w,this}addScalar(J){return this.x+=J,this.y+=J,this.z+=J,this.w+=J,this}addVectors(J,Q){return this.x=J.x+Q.x,this.y=J.y+Q.y,this.z=J.z+Q.z,this.w=J.w+Q.w,this}addScaledVector(J,Q){return this.x+=J.x*Q,this.y+=J.y*Q,this.z+=J.z*Q,this.w+=J.w*Q,this}sub(J){return this.x-=J.x,this.y-=J.y,this.z-=J.z,this.w-=J.w,this}subScalar(J){return this.x-=J,this.y-=J,this.z-=J,this.w-=J,this}subVectors(J,Q){return this.x=J.x-Q.x,this.y=J.y-Q.y,this.z=J.z-Q.z,this.w=J.w-Q.w,this}multiply(J){return this.x*=J.x,this.y*=J.y,this.z*=J.z,this.w*=J.w,this}multiplyScalar(J){return this.x*=J,this.y*=J,this.z*=J,this.w*=J,this}applyMatrix4(J){let Q=this.x,$=this.y,Z=this.z,W=this.w,H=J.elements;return this.x=H[0]*Q+H[4]*$+H[8]*Z+H[12]*W,this.y=H[1]*Q+H[5]*$+H[9]*Z+H[13]*W,this.z=H[2]*Q+H[6]*$+H[10]*Z+H[14]*W,this.w=H[3]*Q+H[7]*$+H[11]*Z+H[15]*W,this}divide(J){return this.x/=J.x,this.y/=J.y,this.z/=J.z,this.w/=J.w,this}divideScalar(J){return this.multiplyScalar(1/J)}setAxisAngleFromQuaternion(J){this.w=2*Math.acos(J.w);let Q=Math.sqrt(1-J.w*J.w);if(Q<0.0001)this.x=1,this.y=0,this.z=0;else this.x=J.x/Q,this.y=J.y/Q,this.z=J.z/Q;return this}setAxisAngleFromRotationMatrix(J){let Q,$,Z,W,H=0.01,Y=0.1,X=J.elements,K=X[0],U=X[4],G=X[8],q=X[1],E=X[5],O=X[9],D=X[2],k=X[6],N=X[10];if(Math.abs(U-q)<0.01&&Math.abs(G-D)<0.01&&Math.abs(O-k)<0.01){if(Math.abs(U+q)<0.1&&Math.abs(G+D)<0.1&&Math.abs(O+k)<0.1&&Math.abs(K+E+N-3)<0.1)return this.set(1,0,0,0),this;Q=Math.PI;let C=(K+1)/2,L=(E+1)/2,_=(N+1)/2,j=(U+q)/4,w=(G+D)/4,S=(O+k)/4;if(C>L&&C>_)if(C<0.01)$=0,Z=0.707106781,W=0.707106781;else $=Math.sqrt(C),Z=j/$,W=w/$;else if(L>_)if(L<0.01)$=0.707106781,Z=0,W=0.707106781;else Z=Math.sqrt(L),$=j/Z,W=S/Z;else if(_<0.01)$=0.707106781,Z=0.707106781,W=0;else W=Math.sqrt(_),$=w/W,Z=S/W;return this.set($,Z,W,Q),this}let F=Math.sqrt((k-O)*(k-O)+(G-D)*(G-D)+(q-U)*(q-U));if(Math.abs(F)<0.001)F=1;return this.x=(k-O)/F,this.y=(G-D)/F,this.z=(q-U)/F,this.w=Math.acos((K+E+N-1)/2),this}setFromMatrixPosition(J){let Q=J.elements;return this.x=Q[12],this.y=Q[13],this.z=Q[14],this.w=Q[15],this}min(J){return this.x=Math.min(this.x,J.x),this.y=Math.min(this.y,J.y),this.z=Math.min(this.z,J.z),this.w=Math.min(this.w,J.w),this}max(J){return this.x=Math.max(this.x,J.x),this.y=Math.max(this.y,J.y),this.z=Math.max(this.z,J.z),this.w=Math.max(this.w,J.w),this}clamp(J,Q){return this.x=d0(this.x,J.x,Q.x),this.y=d0(this.y,J.y,Q.y),this.z=d0(this.z,J.z,Q.z),this.w=d0(this.w,J.w,Q.w),this}clampScalar(J,Q){return this.x=d0(this.x,J,Q),this.y=d0(this.y,J,Q),this.z=d0(this.z,J,Q),this.w=d0(this.w,J,Q),this}clampLength(J,Q){let $=this.length();return this.divideScalar($||1).multiplyScalar(d0($,J,Q))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(J){return this.x*J.x+this.y*J.y+this.z*J.z+this.w*J.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(J){return this.normalize().multiplyScalar(J)}lerp(J,Q){return this.x+=(J.x-this.x)*Q,this.y+=(J.y-this.y)*Q,this.z+=(J.z-this.z)*Q,this.w+=(J.w-this.w)*Q,this}lerpVectors(J,Q,$){return this.x=J.x+(Q.x-J.x)*$,this.y=J.y+(Q.y-J.y)*$,this.z=J.z+(Q.z-J.z)*$,this.w=J.w+(Q.w-J.w)*$,this}equals(J){return J.x===this.x&&J.y===this.y&&J.z===this.z&&J.w===this.w}fromArray(J,Q=0){return this.x=J[Q],this.y=J[Q+1],this.z=J[Q+2],this.w=J[Q+3],this}toArray(J=[],Q=0){return J[Q]=this.x,J[Q+1]=this.y,J[Q+2]=this.z,J[Q+3]=this.w,J}fromBufferAttribute(J,Q){return this.x=J.getX(Q),this.y=J.getY(Q),this.z=J.getZ(Q),this.w=J.getW(Q),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class d$ extends x8{constructor(J=1,Q=1,$={}){super();$=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:1006,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1},$),this.isRenderTarget=!0,this.width=J,this.height=Q,this.depth=$.depth,this.scissor=new a0(0,0,J,Q),this.scissorTest=!1,this.viewport=new a0(0,0,J,Q);let Z={width:J,height:Q,depth:$.depth},W=new kJ(Z);this.textures=[];let H=$.count;for(let Y=0;Y<H;Y++)this.textures[Y]=W.clone(),this.textures[Y].isRenderTargetTexture=!0,this.textures[Y].renderTarget=this;this._setTextureOptions($),this.depthBuffer=$.depthBuffer,this.stencilBuffer=$.stencilBuffer,this.resolveDepthBuffer=$.resolveDepthBuffer,this.resolveStencilBuffer=$.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=$.depthTexture,this.samples=$.samples,this.multiview=$.multiview}_setTextureOptions(J={}){let Q={minFilter:1006,generateMipmaps:!1,flipY:!1,internalFormat:null};if(J.mapping!==void 0)Q.mapping=J.mapping;if(J.wrapS!==void 0)Q.wrapS=J.wrapS;if(J.wrapT!==void 0)Q.wrapT=J.wrapT;if(J.wrapR!==void 0)Q.wrapR=J.wrapR;if(J.magFilter!==void 0)Q.magFilter=J.magFilter;if(J.minFilter!==void 0)Q.minFilter=J.minFilter;if(J.format!==void 0)Q.format=J.format;if(J.type!==void 0)Q.type=J.type;if(J.anisotropy!==void 0)Q.anisotropy=J.anisotropy;if(J.colorSpace!==void 0)Q.colorSpace=J.colorSpace;if(J.flipY!==void 0)Q.flipY=J.flipY;if(J.generateMipmaps!==void 0)Q.generateMipmaps=J.generateMipmaps;if(J.internalFormat!==void 0)Q.internalFormat=J.internalFormat;for(let $=0;$<this.textures.length;$++)this.textures[$].setValues(Q)}get texture(){return this.textures[0]}set texture(J){this.textures[0]=J}set depthTexture(J){if(this._depthTexture!==null)this._depthTexture.renderTarget=null;if(J!==null)J.renderTarget=this;this._depthTexture=J}get depthTexture(){return this._depthTexture}setSize(J,Q,$=1){if(this.width!==J||this.height!==Q||this.depth!==$){this.width=J,this.height=Q,this.depth=$;for(let Z=0,W=this.textures.length;Z<W;Z++)this.textures[Z].image.width=J,this.textures[Z].image.height=Q,this.textures[Z].image.depth=$,this.textures[Z].isArrayTexture=this.textures[Z].image.depth>1;this.dispose()}this.viewport.set(0,0,J,Q),this.scissor.set(0,0,J,Q)}clone(){return new this.constructor().copy(this)}copy(J){this.width=J.width,this.height=J.height,this.depth=J.depth,this.scissor.copy(J.scissor),this.scissorTest=J.scissorTest,this.viewport.copy(J.viewport),this.textures.length=0;for(let Q=0,$=J.textures.length;Q<$;Q++){this.textures[Q]=J.textures[Q].clone(),this.textures[Q].isRenderTargetTexture=!0,this.textures[Q].renderTarget=this;let Z=Object.assign({},J.textures[Q].image);this.textures[Q].source=new A6(Z)}if(this.depthBuffer=J.depthBuffer,this.stencilBuffer=J.stencilBuffer,this.resolveDepthBuffer=J.resolveDepthBuffer,this.resolveStencilBuffer=J.resolveStencilBuffer,J.depthTexture!==null)this.depthTexture=J.depthTexture.clone();return this.samples=J.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class b8 extends d${constructor(J=1,Q=1,$={}){super(J,Q,$);this.isWebGLRenderTarget=!0}}class x7 extends kJ{constructor(J=null,Q=1,$=1,Z=1){super(null);this.isDataArrayTexture=!0,this.image={data:J,width:Q,height:$,depth:Z},this.magFilter=1003,this.minFilter=1003,this.wrapR=1001,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(J){this.layerUpdates.add(J)}clearLayerUpdates(){this.layerUpdates.clear()}}class m$ extends kJ{constructor(J=null,Q=1,$=1,Z=1){super(null);this.isData3DTexture=!0,this.image={data:J,width:Q,height:$,depth:Z},this.magFilter=1003,this.minFilter=1003,this.wrapR=1001,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class wJ{constructor(J=new P(1/0,1/0,1/0),Q=new P(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=J,this.max=Q}set(J,Q){return this.min.copy(J),this.max.copy(Q),this}setFromArray(J){this.makeEmpty();for(let Q=0,$=J.length;Q<$;Q+=3)this.expandByPoint(H8.fromArray(J,Q));return this}setFromBufferAttribute(J){this.makeEmpty();for(let Q=0,$=J.count;Q<$;Q++)this.expandByPoint(H8.fromBufferAttribute(J,Q));return this}setFromPoints(J){this.makeEmpty();for(let Q=0,$=J.length;Q<$;Q++)this.expandByPoint(J[Q]);return this}setFromCenterAndSize(J,Q){let $=H8.copy(Q).multiplyScalar(0.5);return this.min.copy(J).sub($),this.max.copy(J).add($),this}setFromObject(J,Q=!1){return this.makeEmpty(),this.expandByObject(J,Q)}clone(){return new this.constructor().copy(this)}copy(J){return this.min.copy(J.min),this.max.copy(J.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(J){return this.isEmpty()?J.set(0,0,0):J.addVectors(this.min,this.max).multiplyScalar(0.5)}getSize(J){return this.isEmpty()?J.set(0,0,0):J.subVectors(this.max,this.min)}expandByPoint(J){return this.min.min(J),this.max.max(J),this}expandByVector(J){return this.min.sub(J),this.max.add(J),this}expandByScalar(J){return this.min.addScalar(-J),this.max.addScalar(J),this}expandByObject(J,Q=!1){J.updateWorldMatrix(!1,!1);let $=J.geometry;if($!==void 0){let W=$.getAttribute("position");if(Q===!0&&W!==void 0&&J.isInstancedMesh!==!0)for(let H=0,Y=W.count;H<Y;H++){if(J.isMesh===!0)J.getVertexPosition(H,H8);else H8.fromBufferAttribute(W,H);H8.applyMatrix4(J.matrixWorld),this.expandByPoint(H8)}else{if(J.boundingBox!==void 0){if(J.boundingBox===null)J.computeBoundingBox();c6.copy(J.boundingBox)}else{if($.boundingBox===null)$.computeBoundingBox();c6.copy($.boundingBox)}c6.applyMatrix4(J.matrixWorld),this.union(c6)}}let Z=J.children;for(let W=0,H=Z.length;W<H;W++)this.expandByObject(Z[W],Q);return this}containsPoint(J){return J.x>=this.min.x&&J.x<=this.max.x&&J.y>=this.min.y&&J.y<=this.max.y&&J.z>=this.min.z&&J.z<=this.max.z}containsBox(J){return this.min.x<=J.min.x&&J.max.x<=this.max.x&&this.min.y<=J.min.y&&J.max.y<=this.max.y&&this.min.z<=J.min.z&&J.max.z<=this.max.z}getParameter(J,Q){return Q.set((J.x-this.min.x)/(this.max.x-this.min.x),(J.y-this.min.y)/(this.max.y-this.min.y),(J.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(J){return J.max.x>=this.min.x&&J.min.x<=this.max.x&&J.max.y>=this.min.y&&J.min.y<=this.max.y&&J.max.z>=this.min.z&&J.min.z<=this.max.z}intersectsSphere(J){return this.clampPoint(J.center,H8),H8.distanceToSquared(J.center)<=J.radius*J.radius}intersectsPlane(J){let Q,$;if(J.normal.x>0)Q=J.normal.x*this.min.x,$=J.normal.x*this.max.x;else Q=J.normal.x*this.max.x,$=J.normal.x*this.min.x;if(J.normal.y>0)Q+=J.normal.y*this.min.y,$+=J.normal.y*this.max.y;else Q+=J.normal.y*this.max.y,$+=J.normal.y*this.min.y;if(J.normal.z>0)Q+=J.normal.z*this.min.z,$+=J.normal.z*this.max.z;else Q+=J.normal.z*this.max.z,$+=J.normal.z*this.min.z;return Q<=-J.constant&&$>=-J.constant}intersectsTriangle(J){if(this.isEmpty())return!1;this.getCenter(N6),n6.subVectors(this.max,N6),y9.subVectors(J.a,N6),v9.subVectors(J.b,N6),f9.subVectors(J.c,N6),l8.subVectors(v9,y9),d8.subVectors(f9,v9),G9.subVectors(y9,f9);let Q=[0,-l8.z,l8.y,0,-d8.z,d8.y,0,-G9.z,G9.y,l8.z,0,-l8.x,d8.z,0,-d8.x,G9.z,0,-G9.x,-l8.y,l8.x,0,-d8.y,d8.x,0,-G9.y,G9.x,0];if(!BQ(Q,y9,v9,f9,n6))return!1;if(Q=[1,0,0,0,1,0,0,0,1],!BQ(Q,y9,v9,f9,n6))return!1;return s6.crossVectors(l8,d8),Q=[s6.x,s6.y,s6.z],BQ(Q,y9,v9,f9,n6)}clampPoint(J,Q){return Q.copy(J).clamp(this.min,this.max)}distanceToPoint(J){return this.clampPoint(J,H8).distanceTo(J)}getBoundingSphere(J){if(this.isEmpty())J.makeEmpty();else this.getCenter(J.center),J.radius=this.getSize(H8).length()*0.5;return J}intersect(J){if(this.min.max(J.min),this.max.min(J.max),this.isEmpty())this.makeEmpty();return this}union(J){return this.min.min(J.min),this.max.max(J.max),this}applyMatrix4(J){if(this.isEmpty())return this;return _8[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(J),_8[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(J),_8[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(J),_8[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(J),_8[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(J),_8[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(J),_8[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(J),_8[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(J),this.setFromPoints(_8),this}translate(J){return this.min.add(J),this.max.add(J),this}equals(J){return J.min.equals(this.min)&&J.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(J){return this.min.fromArray(J.min),this.max.fromArray(J.max),this}}var _8=[new P,new P,new P,new P,new P,new P,new P,new P],H8=new P,c6=new wJ,y9=new P,v9=new P,f9=new P,l8=new P,d8=new P,G9=new P,N6=new P,n6=new P,s6=new P,q9=new P;function BQ(J,Q,$,Z,W){for(let H=0,Y=J.length-3;H<=Y;H+=3){q9.fromArray(J,H);let X=W.x*Math.abs(q9.x)+W.y*Math.abs(q9.y)+W.z*Math.abs(q9.z),K=Q.dot(q9),U=$.dot(q9),G=Z.dot(q9);if(Math.max(-Math.max(K,U,G),Math.min(K,U,G))>X)return!1}return!0}var kX=new wJ,F6=new P,CQ=new P;class nJ{constructor(J=new P,Q=-1){this.isSphere=!0,this.center=J,this.radius=Q}set(J,Q){return this.center.copy(J),this.radius=Q,this}setFromPoints(J,Q){let $=this.center;if(Q!==void 0)$.copy(Q);else kX.setFromPoints(J).getCenter($);let Z=0;for(let W=0,H=J.length;W<H;W++)Z=Math.max(Z,$.distanceToSquared(J[W]));return this.radius=Math.sqrt(Z),this}copy(J){return this.center.copy(J.center),this.radius=J.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(J){return J.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(J){return J.distanceTo(this.center)-this.radius}intersectsSphere(J){let Q=this.radius+J.radius;return J.center.distanceToSquared(this.center)<=Q*Q}intersectsBox(J){return J.intersectsSphere(this)}intersectsPlane(J){return Math.abs(J.distanceToPoint(this.center))<=this.radius}clampPoint(J,Q){let $=this.center.distanceToSquared(J);if(Q.copy(J),$>this.radius*this.radius)Q.sub(this.center).normalize(),Q.multiplyScalar(this.radius).add(this.center);return Q}getBoundingBox(J){if(this.isEmpty())return J.makeEmpty(),J;return J.set(this.center,this.center),J.expandByScalar(this.radius),J}applyMatrix4(J){return this.center.applyMatrix4(J),this.radius=this.radius*J.getMaxScaleOnAxis(),this}translate(J){return this.center.add(J),this}expandByPoint(J){if(this.isEmpty())return this.center.copy(J),this.radius=0,this;F6.subVectors(J,this.center);let Q=F6.lengthSq();if(Q>this.radius*this.radius){let $=Math.sqrt(Q),Z=($-this.radius)*0.5;this.center.addScaledVector(F6,Z/$),this.radius+=Z}return this}union(J){if(J.isEmpty())return this;if(this.isEmpty())return this.copy(J),this;if(this.center.equals(J.center)===!0)this.radius=Math.max(this.radius,J.radius);else CQ.subVectors(J.center,this.center).setLength(J.radius),this.expandByPoint(F6.copy(J.center).add(CQ)),this.expandByPoint(F6.copy(J.center).sub(CQ));return this}equals(J){return J.center.equals(this.center)&&J.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(J){return this.radius=J.radius,this.center.fromArray(J.center),this}}var w8=new P,_Q=new P,o6=new P,m8=new P,wQ=new P,i6=new P,IQ=new P;class F8{constructor(J=new P,Q=new P(0,0,-1)){this.origin=J,this.direction=Q}set(J,Q){return this.origin.copy(J),this.direction.copy(Q),this}copy(J){return this.origin.copy(J.origin),this.direction.copy(J.direction),this}at(J,Q){return Q.copy(this.origin).addScaledVector(this.direction,J)}lookAt(J){return this.direction.copy(J).sub(this.origin).normalize(),this}recast(J){return this.origin.copy(this.at(J,w8)),this}closestPointToPoint(J,Q){Q.subVectors(J,this.origin);let $=Q.dot(this.direction);if($<0)return Q.copy(this.origin);return Q.copy(this.origin).addScaledVector(this.direction,$)}distanceToPoint(J){return Math.sqrt(this.distanceSqToPoint(J))}distanceSqToPoint(J){let Q=w8.subVectors(J,this.origin).dot(this.direction);if(Q<0)return this.origin.distanceToSquared(J);return w8.copy(this.origin).addScaledVector(this.direction,Q),w8.distanceToSquared(J)}distanceSqToSegment(J,Q,$,Z){_Q.copy(J).add(Q).multiplyScalar(0.5),o6.copy(Q).sub(J).normalize(),m8.copy(this.origin).sub(_Q);let W=J.distanceTo(Q)*0.5,H=-this.direction.dot(o6),Y=m8.dot(this.direction),X=-m8.dot(o6),K=m8.lengthSq(),U=Math.abs(1-H*H),G,q,E,O;if(U>0)if(G=H*X-Y,q=H*Y-X,O=W*U,G>=0)if(q>=-O)if(q<=O){let D=1/U;G*=D,q*=D,E=G*(G+H*q+2*Y)+q*(H*G+q+2*X)+K}else q=W,G=Math.max(0,-(H*q+Y)),E=-G*G+q*(q+2*X)+K;else q=-W,G=Math.max(0,-(H*q+Y)),E=-G*G+q*(q+2*X)+K;else if(q<=-O)G=Math.max(0,-(-H*W+Y)),q=G>0?-W:Math.min(Math.max(-W,-X),W),E=-G*G+q*(q+2*X)+K;else if(q<=O)G=0,q=Math.min(Math.max(-W,-X),W),E=q*(q+2*X)+K;else G=Math.max(0,-(H*W+Y)),q=G>0?W:Math.min(Math.max(-W,-X),W),E=-G*G+q*(q+2*X)+K;else q=H>0?-W:W,G=Math.max(0,-(H*q+Y)),E=-G*G+q*(q+2*X)+K;if($)$.copy(this.origin).addScaledVector(this.direction,G);if(Z)Z.copy(_Q).addScaledVector(o6,q);return E}intersectSphere(J,Q){w8.subVectors(J.center,this.origin);let $=w8.dot(this.direction),Z=w8.dot(w8)-$*$,W=J.radius*J.radius;if(Z>W)return null;let H=Math.sqrt(W-Z),Y=$-H,X=$+H;if(X<0)return null;if(Y<0)return this.at(X,Q);return this.at(Y,Q)}intersectsSphere(J){if(J.radius<0)return!1;return this.distanceSqToPoint(J.center)<=J.radius*J.radius}distanceToPlane(J){let Q=J.normal.dot(this.direction);if(Q===0){if(J.distanceToPoint(this.origin)===0)return 0;return null}let $=-(this.origin.dot(J.normal)+J.constant)/Q;return $>=0?$:null}intersectPlane(J,Q){let $=this.distanceToPlane(J);if($===null)return null;return this.at($,Q)}intersectsPlane(J){let Q=J.distanceToPoint(this.origin);if(Q===0)return!0;if(J.normal.dot(this.direction)*Q<0)return!0;return!1}intersectBox(J,Q){let $,Z,W,H,Y,X,K=1/this.direction.x,U=1/this.direction.y,G=1/this.direction.z,q=this.origin;if(K>=0)$=(J.min.x-q.x)*K,Z=(J.max.x-q.x)*K;else $=(J.max.x-q.x)*K,Z=(J.min.x-q.x)*K;if(U>=0)W=(J.min.y-q.y)*U,H=(J.max.y-q.y)*U;else W=(J.max.y-q.y)*U,H=(J.min.y-q.y)*U;if($>H||W>Z)return null;if(W>$||isNaN($))$=W;if(H<Z||isNaN(Z))Z=H;if(G>=0)Y=(J.min.z-q.z)*G,X=(J.max.z-q.z)*G;else Y=(J.max.z-q.z)*G,X=(J.min.z-q.z)*G;if($>X||Y>Z)return null;if(Y>$||$!==$)$=Y;if(X<Z||Z!==Z)Z=X;if(Z<0)return null;return this.at($>=0?$:Z,Q)}intersectsBox(J){return this.intersectBox(J,w8)!==null}intersectTriangle(J,Q,$,Z,W){wQ.subVectors(Q,J),i6.subVectors($,J),IQ.crossVectors(wQ,i6);let H=this.direction.dot(IQ),Y;if(H>0){if(Z)return null;Y=1}else if(H<0)Y=-1,H=-H;else return null;m8.subVectors(this.origin,J);let X=Y*this.direction.dot(i6.crossVectors(m8,i6));if(X<0)return null;let K=Y*this.direction.dot(wQ.cross(m8));if(K<0)return null;if(X+K>H)return null;let U=-Y*m8.dot(IQ);if(U<0)return null;return this.at(U/H,W)}applyMatrix4(J){return this.origin.applyMatrix4(J),this.direction.transformDirection(J),this}equals(J){return J.origin.equals(this.origin)&&J.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class j0{constructor(J,Q,$,Z,W,H,Y,X,K,U,G,q,E,O,D,k){if(j0.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],J!==void 0)this.set(J,Q,$,Z,W,H,Y,X,K,U,G,q,E,O,D,k)}set(J,Q,$,Z,W,H,Y,X,K,U,G,q,E,O,D,k){let N=this.elements;return N[0]=J,N[4]=Q,N[8]=$,N[12]=Z,N[1]=W,N[5]=H,N[9]=Y,N[13]=X,N[2]=K,N[6]=U,N[10]=G,N[14]=q,N[3]=E,N[7]=O,N[11]=D,N[15]=k,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new j0().fromArray(this.elements)}copy(J){let Q=this.elements,$=J.elements;return Q[0]=$[0],Q[1]=$[1],Q[2]=$[2],Q[3]=$[3],Q[4]=$[4],Q[5]=$[5],Q[6]=$[6],Q[7]=$[7],Q[8]=$[8],Q[9]=$[9],Q[10]=$[10],Q[11]=$[11],Q[12]=$[12],Q[13]=$[13],Q[14]=$[14],Q[15]=$[15],this}copyPosition(J){let Q=this.elements,$=J.elements;return Q[12]=$[12],Q[13]=$[13],Q[14]=$[14],this}setFromMatrix3(J){let Q=J.elements;return this.set(Q[0],Q[3],Q[6],0,Q[1],Q[4],Q[7],0,Q[2],Q[5],Q[8],0,0,0,0,1),this}extractBasis(J,Q,$){return J.setFromMatrixColumn(this,0),Q.setFromMatrixColumn(this,1),$.setFromMatrixColumn(this,2),this}makeBasis(J,Q,$){return this.set(J.x,Q.x,$.x,0,J.y,Q.y,$.y,0,J.z,Q.z,$.z,0,0,0,0,1),this}extractRotation(J){let Q=this.elements,$=J.elements,Z=1/h9.setFromMatrixColumn(J,0).length(),W=1/h9.setFromMatrixColumn(J,1).length(),H=1/h9.setFromMatrixColumn(J,2).length();return Q[0]=$[0]*Z,Q[1]=$[1]*Z,Q[2]=$[2]*Z,Q[3]=0,Q[4]=$[4]*W,Q[5]=$[5]*W,Q[6]=$[6]*W,Q[7]=0,Q[8]=$[8]*H,Q[9]=$[9]*H,Q[10]=$[10]*H,Q[11]=0,Q[12]=0,Q[13]=0,Q[14]=0,Q[15]=1,this}makeRotationFromEuler(J){let Q=this.elements,$=J.x,Z=J.y,W=J.z,H=Math.cos($),Y=Math.sin($),X=Math.cos(Z),K=Math.sin(Z),U=Math.cos(W),G=Math.sin(W);if(J.order==="XYZ"){let q=H*U,E=H*G,O=Y*U,D=Y*G;Q[0]=X*U,Q[4]=-X*G,Q[8]=K,Q[1]=E+O*K,Q[5]=q-D*K,Q[9]=-Y*X,Q[2]=D-q*K,Q[6]=O+E*K,Q[10]=H*X}else if(J.order==="YXZ"){let q=X*U,E=X*G,O=K*U,D=K*G;Q[0]=q+D*Y,Q[4]=O*Y-E,Q[8]=H*K,Q[1]=H*G,Q[5]=H*U,Q[9]=-Y,Q[2]=E*Y-O,Q[6]=D+q*Y,Q[10]=H*X}else if(J.order==="ZXY"){let q=X*U,E=X*G,O=K*U,D=K*G;Q[0]=q-D*Y,Q[4]=-H*G,Q[8]=O+E*Y,Q[1]=E+O*Y,Q[5]=H*U,Q[9]=D-q*Y,Q[2]=-H*K,Q[6]=Y,Q[10]=H*X}else if(J.order==="ZYX"){let q=H*U,E=H*G,O=Y*U,D=Y*G;Q[0]=X*U,Q[4]=O*K-E,Q[8]=q*K+D,Q[1]=X*G,Q[5]=D*K+q,Q[9]=E*K-O,Q[2]=-K,Q[6]=Y*X,Q[10]=H*X}else if(J.order==="YZX"){let q=H*X,E=H*K,O=Y*X,D=Y*K;Q[0]=X*U,Q[4]=D-q*G,Q[8]=O*G+E,Q[1]=G,Q[5]=H*U,Q[9]=-Y*U,Q[2]=-K*U,Q[6]=E*G+O,Q[10]=q-D*G}else if(J.order==="XZY"){let q=H*X,E=H*K,O=Y*X,D=Y*K;Q[0]=X*U,Q[4]=-G,Q[8]=K*U,Q[1]=q*G+D,Q[5]=H*U,Q[9]=E*G-O,Q[2]=O*G-E,Q[6]=Y*U,Q[10]=D*G+q}return Q[3]=0,Q[7]=0,Q[11]=0,Q[12]=0,Q[13]=0,Q[14]=0,Q[15]=1,this}makeRotationFromQuaternion(J){return this.compose(DX,J,MX)}lookAt(J,Q,$){let Z=this.elements;if(dJ.subVectors(J,Q),dJ.lengthSq()===0)dJ.z=1;if(dJ.normalize(),u8.crossVectors($,dJ),u8.lengthSq()===0){if(Math.abs($.z)===1)dJ.x+=0.0001;else dJ.z+=0.0001;dJ.normalize(),u8.crossVectors($,dJ)}return u8.normalize(),a6.crossVectors(dJ,u8),Z[0]=u8.x,Z[4]=a6.x,Z[8]=dJ.x,Z[1]=u8.y,Z[5]=a6.y,Z[9]=dJ.y,Z[2]=u8.z,Z[6]=a6.z,Z[10]=dJ.z,this}multiply(J){return this.multiplyMatrices(this,J)}premultiply(J){return this.multiplyMatrices(J,this)}multiplyMatrices(J,Q){let $=J.elements,Z=Q.elements,W=this.elements,H=$[0],Y=$[4],X=$[8],K=$[12],U=$[1],G=$[5],q=$[9],E=$[13],O=$[2],D=$[6],k=$[10],N=$[14],F=$[3],C=$[7],L=$[11],_=$[15],j=Z[0],w=Z[4],S=Z[8],p=Z[12],z=Z[1],V=Z[5],A=Z[9],m=Z[13],c=Z[2],l=Z[6],i=Z[10],u=Z[14],r=Z[3],b=Z[7],X0=Z[11],g=Z[15];return W[0]=H*j+Y*z+X*c+K*r,W[4]=H*w+Y*V+X*l+K*b,W[8]=H*S+Y*A+X*i+K*X0,W[12]=H*p+Y*m+X*u+K*g,W[1]=U*j+G*z+q*c+E*r,W[5]=U*w+G*V+q*l+E*b,W[9]=U*S+G*A+q*i+E*X0,W[13]=U*p+G*m+q*u+E*g,W[2]=O*j+D*z+k*c+N*r,W[6]=O*w+D*V+k*l+N*b,W[10]=O*S+D*A+k*i+N*X0,W[14]=O*p+D*m+k*u+N*g,W[3]=F*j+C*z+L*c+_*r,W[7]=F*w+C*V+L*l+_*b,W[11]=F*S+C*A+L*i+_*X0,W[15]=F*p+C*m+L*u+_*g,this}multiplyScalar(J){let Q=this.elements;return Q[0]*=J,Q[4]*=J,Q[8]*=J,Q[12]*=J,Q[1]*=J,Q[5]*=J,Q[9]*=J,Q[13]*=J,Q[2]*=J,Q[6]*=J,Q[10]*=J,Q[14]*=J,Q[3]*=J,Q[7]*=J,Q[11]*=J,Q[15]*=J,this}determinant(){let J=this.elements,Q=J[0],$=J[4],Z=J[8],W=J[12],H=J[1],Y=J[5],X=J[9],K=J[13],U=J[2],G=J[6],q=J[10],E=J[14],O=J[3],D=J[7],k=J[11],N=J[15];return O*(+W*X*G-Z*K*G-W*Y*q+$*K*q+Z*Y*E-$*X*E)+D*(+Q*X*E-Q*K*q+W*H*q-Z*H*E+Z*K*U-W*X*U)+k*(+Q*K*G-Q*Y*E-W*H*G+$*H*E+W*Y*U-$*K*U)+N*(-Z*Y*U-Q*X*G+Q*Y*q+Z*H*G-$*H*q+$*X*U)}transpose(){let J=this.elements,Q;return Q=J[1],J[1]=J[4],J[4]=Q,Q=J[2],J[2]=J[8],J[8]=Q,Q=J[6],J[6]=J[9],J[9]=Q,Q=J[3],J[3]=J[12],J[12]=Q,Q=J[7],J[7]=J[13],J[13]=Q,Q=J[11],J[11]=J[14],J[14]=Q,this}setPosition(J,Q,$){let Z=this.elements;if(J.isVector3)Z[12]=J.x,Z[13]=J.y,Z[14]=J.z;else Z[12]=J,Z[13]=Q,Z[14]=$;return this}invert(){let J=this.elements,Q=J[0],$=J[1],Z=J[2],W=J[3],H=J[4],Y=J[5],X=J[6],K=J[7],U=J[8],G=J[9],q=J[10],E=J[11],O=J[12],D=J[13],k=J[14],N=J[15],F=G*k*K-D*q*K+D*X*E-Y*k*E-G*X*N+Y*q*N,C=O*q*K-U*k*K-O*X*E+H*k*E+U*X*N-H*q*N,L=U*D*K-O*G*K+O*Y*E-H*D*E-U*Y*N+H*G*N,_=O*G*X-U*D*X-O*Y*q+H*D*q+U*Y*k-H*G*k,j=Q*F+$*C+Z*L+W*_;if(j===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let w=1/j;return J[0]=F*w,J[1]=(D*q*W-G*k*W-D*Z*E+$*k*E+G*Z*N-$*q*N)*w,J[2]=(Y*k*W-D*X*W+D*Z*K-$*k*K-Y*Z*N+$*X*N)*w,J[3]=(G*X*W-Y*q*W-G*Z*K+$*q*K+Y*Z*E-$*X*E)*w,J[4]=C*w,J[5]=(U*k*W-O*q*W+O*Z*E-Q*k*E-U*Z*N+Q*q*N)*w,J[6]=(O*X*W-H*k*W-O*Z*K+Q*k*K+H*Z*N-Q*X*N)*w,J[7]=(H*q*W-U*X*W+U*Z*K-Q*q*K-H*Z*E+Q*X*E)*w,J[8]=L*w,J[9]=(O*G*W-U*D*W-O*$*E+Q*D*E+U*$*N-Q*G*N)*w,J[10]=(H*D*W-O*Y*W+O*$*K-Q*D*K-H*$*N+Q*Y*N)*w,J[11]=(U*Y*W-H*G*W-U*$*K+Q*G*K+H*$*E-Q*Y*E)*w,J[12]=_*w,J[13]=(U*D*Z-O*G*Z+O*$*q-Q*D*q-U*$*k+Q*G*k)*w,J[14]=(O*Y*Z-H*D*Z-O*$*X+Q*D*X+H*$*k-Q*Y*k)*w,J[15]=(H*G*Z-U*Y*Z+U*$*X-Q*G*X-H*$*q+Q*Y*q)*w,this}scale(J){let Q=this.elements,$=J.x,Z=J.y,W=J.z;return Q[0]*=$,Q[4]*=Z,Q[8]*=W,Q[1]*=$,Q[5]*=Z,Q[9]*=W,Q[2]*=$,Q[6]*=Z,Q[10]*=W,Q[3]*=$,Q[7]*=Z,Q[11]*=W,this}getMaxScaleOnAxis(){let J=this.elements,Q=J[0]*J[0]+J[1]*J[1]+J[2]*J[2],$=J[4]*J[4]+J[5]*J[5]+J[6]*J[6],Z=J[8]*J[8]+J[9]*J[9]+J[10]*J[10];return Math.sqrt(Math.max(Q,$,Z))}makeTranslation(J,Q,$){if(J.isVector3)this.set(1,0,0,J.x,0,1,0,J.y,0,0,1,J.z,0,0,0,1);else this.set(1,0,0,J,0,1,0,Q,0,0,1,$,0,0,0,1);return this}makeRotationX(J){let Q=Math.cos(J),$=Math.sin(J);return this.set(1,0,0,0,0,Q,-$,0,0,$,Q,0,0,0,0,1),this}makeRotationY(J){let Q=Math.cos(J),$=Math.sin(J);return this.set(Q,0,$,0,0,1,0,0,-$,0,Q,0,0,0,0,1),this}makeRotationZ(J){let Q=Math.cos(J),$=Math.sin(J);return this.set(Q,-$,0,0,$,Q,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(J,Q){let $=Math.cos(Q),Z=Math.sin(Q),W=1-$,H=J.x,Y=J.y,X=J.z,K=W*H,U=W*Y;return this.set(K*H+$,K*Y-Z*X,K*X+Z*Y,0,K*Y+Z*X,U*Y+$,U*X-Z*H,0,K*X-Z*Y,U*X+Z*H,W*X*X+$,0,0,0,0,1),this}makeScale(J,Q,$){return this.set(J,0,0,0,0,Q,0,0,0,0,$,0,0,0,0,1),this}makeShear(J,Q,$,Z,W,H){return this.set(1,$,W,0,J,1,H,0,Q,Z,1,0,0,0,0,1),this}compose(J,Q,$){let Z=this.elements,W=Q._x,H=Q._y,Y=Q._z,X=Q._w,K=W+W,U=H+H,G=Y+Y,q=W*K,E=W*U,O=W*G,D=H*U,k=H*G,N=Y*G,F=X*K,C=X*U,L=X*G,_=$.x,j=$.y,w=$.z;return Z[0]=(1-(D+N))*_,Z[1]=(E+L)*_,Z[2]=(O-C)*_,Z[3]=0,Z[4]=(E-L)*j,Z[5]=(1-(q+N))*j,Z[6]=(k+F)*j,Z[7]=0,Z[8]=(O+C)*w,Z[9]=(k-F)*w,Z[10]=(1-(q+D))*w,Z[11]=0,Z[12]=J.x,Z[13]=J.y,Z[14]=J.z,Z[15]=1,this}decompose(J,Q,$){let Z=this.elements,W=h9.set(Z[0],Z[1],Z[2]).length(),H=h9.set(Z[4],Z[5],Z[6]).length(),Y=h9.set(Z[8],Z[9],Z[10]).length();if(this.determinant()<0)W=-W;J.x=Z[12],J.y=Z[13],J.z=Z[14],Y8.copy(this);let K=1/W,U=1/H,G=1/Y;return Y8.elements[0]*=K,Y8.elements[1]*=K,Y8.elements[2]*=K,Y8.elements[4]*=U,Y8.elements[5]*=U,Y8.elements[6]*=U,Y8.elements[8]*=G,Y8.elements[9]*=G,Y8.elements[10]*=G,Q.setFromRotationMatrix(Y8),$.x=W,$.y=H,$.z=Y,this}makePerspective(J,Q,$,Z,W,H,Y=2000,X=!1){let K=this.elements,U=2*W/(Q-J),G=2*W/($-Z),q=(Q+J)/(Q-J),E=($+Z)/($-Z),O,D;if(X)O=W/(H-W),D=H*W/(H-W);else if(Y===2000)O=-(H+W)/(H-W),D=-2*H*W/(H-W);else if(Y===2001)O=-H/(H-W),D=-H*W/(H-W);else throw Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+Y);return K[0]=U,K[4]=0,K[8]=q,K[12]=0,K[1]=0,K[5]=G,K[9]=E,K[13]=0,K[2]=0,K[6]=0,K[10]=O,K[14]=D,K[3]=0,K[7]=0,K[11]=-1,K[15]=0,this}makeOrthographic(J,Q,$,Z,W,H,Y=2000,X=!1){let K=this.elements,U=2/(Q-J),G=2/($-Z),q=-(Q+J)/(Q-J),E=-($+Z)/($-Z),O,D;if(X)O=1/(H-W),D=H/(H-W);else if(Y===2000)O=-2/(H-W),D=-(H+W)/(H-W);else if(Y===2001)O=-1/(H-W),D=-W/(H-W);else throw Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+Y);return K[0]=U,K[4]=0,K[8]=0,K[12]=q,K[1]=0,K[5]=G,K[9]=0,K[13]=E,K[2]=0,K[6]=0,K[10]=O,K[14]=D,K[3]=0,K[7]=0,K[11]=0,K[15]=1,this}equals(J){let Q=this.elements,$=J.elements;for(let Z=0;Z<16;Z++)if(Q[Z]!==$[Z])return!1;return!0}fromArray(J,Q=0){for(let $=0;$<16;$++)this.elements[$]=J[$+Q];return this}toArray(J=[],Q=0){let $=this.elements;return J[Q]=$[0],J[Q+1]=$[1],J[Q+2]=$[2],J[Q+3]=$[3],J[Q+4]=$[4],J[Q+5]=$[5],J[Q+6]=$[6],J[Q+7]=$[7],J[Q+8]=$[8],J[Q+9]=$[9],J[Q+10]=$[10],J[Q+11]=$[11],J[Q+12]=$[12],J[Q+13]=$[13],J[Q+14]=$[14],J[Q+15]=$[15],J}}var h9=new P,Y8=new j0,DX=new P(0,0,0),MX=new P(1,1,1),u8=new P,a6=new P,dJ=new P,xZ=new j0,bZ=new jJ;class q8{constructor(J=0,Q=0,$=0,Z=q8.DEFAULT_ORDER){this.isEuler=!0,this._x=J,this._y=Q,this._z=$,this._order=Z}get x(){return this._x}set x(J){this._x=J,this._onChangeCallback()}get y(){return this._y}set y(J){this._y=J,this._onChangeCallback()}get z(){return this._z}set z(J){this._z=J,this._onChangeCallback()}get order(){return this._order}set order(J){this._order=J,this._onChangeCallback()}set(J,Q,$,Z=this._order){return this._x=J,this._y=Q,this._z=$,this._order=Z,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(J){return this._x=J._x,this._y=J._y,this._z=J._z,this._order=J._order,this._onChangeCallback(),this}setFromRotationMatrix(J,Q=this._order,$=!0){let Z=J.elements,W=Z[0],H=Z[4],Y=Z[8],X=Z[1],K=Z[5],U=Z[9],G=Z[2],q=Z[6],E=Z[10];switch(Q){case"XYZ":if(this._y=Math.asin(d0(Y,-1,1)),Math.abs(Y)<0.9999999)this._x=Math.atan2(-U,E),this._z=Math.atan2(-H,W);else this._x=Math.atan2(q,K),this._z=0;break;case"YXZ":if(this._x=Math.asin(-d0(U,-1,1)),Math.abs(U)<0.9999999)this._y=Math.atan2(Y,E),this._z=Math.atan2(X,K);else this._y=Math.atan2(-G,W),this._z=0;break;case"ZXY":if(this._x=Math.asin(d0(q,-1,1)),Math.abs(q)<0.9999999)this._y=Math.atan2(-G,E),this._z=Math.atan2(-H,K);else this._y=0,this._z=Math.atan2(X,W);break;case"ZYX":if(this._y=Math.asin(-d0(G,-1,1)),Math.abs(G)<0.9999999)this._x=Math.atan2(q,E),this._z=Math.atan2(X,W);else this._x=0,this._z=Math.atan2(-H,K);break;case"YZX":if(this._z=Math.asin(d0(X,-1,1)),Math.abs(X)<0.9999999)this._x=Math.atan2(-U,K),this._y=Math.atan2(-G,W);else this._x=0,this._y=Math.atan2(Y,E);break;case"XZY":if(this._z=Math.asin(-d0(H,-1,1)),Math.abs(H)<0.9999999)this._x=Math.atan2(q,K),this._y=Math.atan2(Y,W);else this._x=Math.atan2(-U,E),this._y=0;break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+Q)}if(this._order=Q,$===!0)this._onChangeCallback();return this}setFromQuaternion(J,Q,$){return xZ.makeRotationFromQuaternion(J),this.setFromRotationMatrix(xZ,Q,$)}setFromVector3(J,Q=this._order){return this.set(J.x,J.y,J.z,Q)}reorder(J){return bZ.setFromEuler(this),this.setFromQuaternion(bZ,J)}equals(J){return J._x===this._x&&J._y===this._y&&J._z===this._z&&J._order===this._order}fromArray(J){if(this._x=J[0],this._y=J[1],this._z=J[2],J[3]!==void 0)this._order=J[3];return this._onChangeCallback(),this}toArray(J=[],Q=0){return J[Q]=this._x,J[Q+1]=this._y,J[Q+2]=this._z,J[Q+3]=this._order,J}_onChange(J){return this._onChangeCallback=J,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}q8.DEFAULT_ORDER="XYZ";class S6{constructor(){this.mask=1}set(J){this.mask=(1<<J|0)>>>0}enable(J){this.mask|=1<<J|0}enableAll(){this.mask=-1}toggle(J){this.mask^=1<<J|0}disable(J){this.mask&=~(1<<J|0)}disableAll(){this.mask=0}test(J){return(this.mask&J.mask)!==0}isEnabled(J){return(this.mask&(1<<J|0))!==0}}var LX=0,gZ=new P,x9=new jJ,I8=new j0,r6=new P,O6=new P,VX=new P,zX=new jJ,pZ=new P(1,0,0),lZ=new P(0,1,0),dZ=new P(0,0,1),mZ={type:"added"},BX={type:"removed"},b9={type:"childadded",child:null},PQ={type:"childremoved",child:null};class YJ extends x8{constructor(){super();this.isObject3D=!0,Object.defineProperty(this,"id",{value:LX++}),this.uuid=G8(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=YJ.DEFAULT_UP.clone();let J=new P,Q=new q8,$=new jJ,Z=new P(1,1,1);function W(){$.setFromEuler(Q,!1)}function H(){Q.setFromQuaternion($,void 0,!1)}Q._onChange(W),$._onChange(H),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:J},rotation:{configurable:!0,enumerable:!0,value:Q},quaternion:{configurable:!0,enumerable:!0,value:$},scale:{configurable:!0,enumerable:!0,value:Z},modelViewMatrix:{value:new j0},normalMatrix:{value:new f0}}),this.matrix=new j0,this.matrixWorld=new j0,this.matrixAutoUpdate=YJ.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=YJ.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new S6,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(J){if(this.matrixAutoUpdate)this.updateMatrix();this.matrix.premultiply(J),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(J){return this.quaternion.premultiply(J),this}setRotationFromAxisAngle(J,Q){this.quaternion.setFromAxisAngle(J,Q)}setRotationFromEuler(J){this.quaternion.setFromEuler(J,!0)}setRotationFromMatrix(J){this.quaternion.setFromRotationMatrix(J)}setRotationFromQuaternion(J){this.quaternion.copy(J)}rotateOnAxis(J,Q){return x9.setFromAxisAngle(J,Q),this.quaternion.multiply(x9),this}rotateOnWorldAxis(J,Q){return x9.setFromAxisAngle(J,Q),this.quaternion.premultiply(x9),this}rotateX(J){return this.rotateOnAxis(pZ,J)}rotateY(J){return this.rotateOnAxis(lZ,J)}rotateZ(J){return this.rotateOnAxis(dZ,J)}translateOnAxis(J,Q){return gZ.copy(J).applyQuaternion(this.quaternion),this.position.add(gZ.multiplyScalar(Q)),this}translateX(J){return this.translateOnAxis(pZ,J)}translateY(J){return this.translateOnAxis(lZ,J)}translateZ(J){return this.translateOnAxis(dZ,J)}localToWorld(J){return this.updateWorldMatrix(!0,!1),J.applyMatrix4(this.matrixWorld)}worldToLocal(J){return this.updateWorldMatrix(!0,!1),J.applyMatrix4(I8.copy(this.matrixWorld).invert())}lookAt(J,Q,$){if(J.isVector3)r6.copy(J);else r6.set(J,Q,$);let Z=this.parent;if(this.updateWorldMatrix(!0,!1),O6.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight)I8.lookAt(O6,r6,this.up);else I8.lookAt(r6,O6,this.up);if(this.quaternion.setFromRotationMatrix(I8),Z)I8.extractRotation(Z.matrixWorld),x9.setFromRotationMatrix(I8),this.quaternion.premultiply(x9.invert())}add(J){if(arguments.length>1){for(let Q=0;Q<arguments.length;Q++)this.add(arguments[Q]);return this}if(J===this)return console.error("THREE.Object3D.add: object can't be added as a child of itself.",J),this;if(J&&J.isObject3D)J.removeFromParent(),J.parent=this,this.children.push(J),J.dispatchEvent(mZ),b9.child=J,this.dispatchEvent(b9),b9.child=null;else console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",J);return this}remove(J){if(arguments.length>1){for(let $=0;$<arguments.length;$++)this.remove(arguments[$]);return this}let Q=this.children.indexOf(J);if(Q!==-1)J.parent=null,this.children.splice(Q,1),J.dispatchEvent(BX),PQ.child=J,this.dispatchEvent(PQ),PQ.child=null;return this}removeFromParent(){let J=this.parent;if(J!==null)J.remove(this);return this}clear(){return this.remove(...this.children)}attach(J){if(this.updateWorldMatrix(!0,!1),I8.copy(this.matrixWorld).invert(),J.parent!==null)J.parent.updateWorldMatrix(!0,!1),I8.multiply(J.parent.matrixWorld);return J.applyMatrix4(I8),J.removeFromParent(),J.parent=this,this.children.push(J),J.updateWorldMatrix(!1,!0),J.dispatchEvent(mZ),b9.child=J,this.dispatchEvent(b9),b9.child=null,this}getObjectById(J){return this.getObjectByProperty("id",J)}getObjectByName(J){return this.getObjectByProperty("name",J)}getObjectByProperty(J,Q){if(this[J]===Q)return this;for(let $=0,Z=this.children.length;$<Z;$++){let H=this.children[$].getObjectByProperty(J,Q);if(H!==void 0)return H}return}getObjectsByProperty(J,Q,$=[]){if(this[J]===Q)$.push(this);let Z=this.children;for(let W=0,H=Z.length;W<H;W++)Z[W].getObjectsByProperty(J,Q,$);return $}getWorldPosition(J){return this.updateWorldMatrix(!0,!1),J.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(J){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(O6,J,VX),J}getWorldScale(J){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(O6,zX,J),J}getWorldDirection(J){this.updateWorldMatrix(!0,!1);let Q=this.matrixWorld.elements;return J.set(Q[8],Q[9],Q[10]).normalize()}raycast(){}traverse(J){J(this);let Q=this.children;for(let $=0,Z=Q.length;$<Z;$++)Q[$].traverse(J)}traverseVisible(J){if(this.visible===!1)return;J(this);let Q=this.children;for(let $=0,Z=Q.length;$<Z;$++)Q[$].traverseVisible(J)}traverseAncestors(J){let Q=this.parent;if(Q!==null)J(Q),Q.traverseAncestors(J)}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(J){if(this.matrixAutoUpdate)this.updateMatrix();if(this.matrixWorldNeedsUpdate||J){if(this.matrixWorldAutoUpdate===!0)if(this.parent===null)this.matrixWorld.copy(this.matrix);else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix);this.matrixWorldNeedsUpdate=!1,J=!0}let Q=this.children;for(let $=0,Z=Q.length;$<Z;$++)Q[$].updateMatrixWorld(J)}updateWorldMatrix(J,Q){let $=this.parent;if(J===!0&&$!==null)$.updateWorldMatrix(!0,!1);if(this.matrixAutoUpdate)this.updateMatrix();if(this.matrixWorldAutoUpdate===!0)if(this.parent===null)this.matrixWorld.copy(this.matrix);else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix);if(Q===!0){let Z=this.children;for(let W=0,H=Z.length;W<H;W++)Z[W].updateWorldMatrix(!1,!0)}}toJSON(J){let Q=J===void 0||typeof J==="string",$={};if(Q)J={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},$.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"};let Z={};if(Z.uuid=this.uuid,Z.type=this.type,this.name!=="")Z.name=this.name;if(this.castShadow===!0)Z.castShadow=!0;if(this.receiveShadow===!0)Z.receiveShadow=!0;if(this.visible===!1)Z.visible=!1;if(this.frustumCulled===!1)Z.frustumCulled=!1;if(this.renderOrder!==0)Z.renderOrder=this.renderOrder;if(Object.keys(this.userData).length>0)Z.userData=this.userData;if(Z.layers=this.layers.mask,Z.matrix=this.matrix.toArray(),Z.up=this.up.toArray(),this.matrixAutoUpdate===!1)Z.matrixAutoUpdate=!1;if(this.isInstancedMesh){if(Z.type="InstancedMesh",Z.count=this.count,Z.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null)Z.instanceColor=this.instanceColor.toJSON()}if(this.isBatchedMesh){if(Z.type="BatchedMesh",Z.perObjectFrustumCulled=this.perObjectFrustumCulled,Z.sortObjects=this.sortObjects,Z.drawRanges=this._drawRanges,Z.reservedRanges=this._reservedRanges,Z.geometryInfo=this._geometryInfo.map((Y)=>({...Y,boundingBox:Y.boundingBox?Y.boundingBox.toJSON():void 0,boundingSphere:Y.boundingSphere?Y.boundingSphere.toJSON():void 0})),Z.instanceInfo=this._instanceInfo.map((Y)=>({...Y})),Z.availableInstanceIds=this._availableInstanceIds.slice(),Z.availableGeometryIds=this._availableGeometryIds.slice(),Z.nextIndexStart=this._nextIndexStart,Z.nextVertexStart=this._nextVertexStart,Z.geometryCount=this._geometryCount,Z.maxInstanceCount=this._maxInstanceCount,Z.maxVertexCount=this._maxVertexCount,Z.maxIndexCount=this._maxIndexCount,Z.geometryInitialized=this._geometryInitialized,Z.matricesTexture=this._matricesTexture.toJSON(J),Z.indirectTexture=this._indirectTexture.toJSON(J),this._colorsTexture!==null)Z.colorsTexture=this._colorsTexture.toJSON(J);if(this.boundingSphere!==null)Z.boundingSphere=this.boundingSphere.toJSON();if(this.boundingBox!==null)Z.boundingBox=this.boundingBox.toJSON()}function W(Y,X){if(Y[X.uuid]===void 0)Y[X.uuid]=X.toJSON(J);return X.uuid}if(this.isScene){if(this.background){if(this.background.isColor)Z.background=this.background.toJSON();else if(this.background.isTexture)Z.background=this.background.toJSON(J).uuid}if(this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0)Z.environment=this.environment.toJSON(J).uuid}else if(this.isMesh||this.isLine||this.isPoints){Z.geometry=W(J.geometries,this.geometry);let Y=this.geometry.parameters;if(Y!==void 0&&Y.shapes!==void 0){let X=Y.shapes;if(Array.isArray(X))for(let K=0,U=X.length;K<U;K++){let G=X[K];W(J.shapes,G)}else W(J.shapes,X)}}if(this.isSkinnedMesh){if(Z.bindMode=this.bindMode,Z.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0)W(J.skeletons,this.skeleton),Z.skeleton=this.skeleton.uuid}if(this.material!==void 0)if(Array.isArray(this.material)){let Y=[];for(let X=0,K=this.material.length;X<K;X++)Y.push(W(J.materials,this.material[X]));Z.material=Y}else Z.material=W(J.materials,this.material);if(this.children.length>0){Z.children=[];for(let Y=0;Y<this.children.length;Y++)Z.children.push(this.children[Y].toJSON(J).object)}if(this.animations.length>0){Z.animations=[];for(let Y=0;Y<this.animations.length;Y++){let X=this.animations[Y];Z.animations.push(W(J.animations,X))}}if(Q){let Y=H(J.geometries),X=H(J.materials),K=H(J.textures),U=H(J.images),G=H(J.shapes),q=H(J.skeletons),E=H(J.animations),O=H(J.nodes);if(Y.length>0)$.geometries=Y;if(X.length>0)$.materials=X;if(K.length>0)$.textures=K;if(U.length>0)$.images=U;if(G.length>0)$.shapes=G;if(q.length>0)$.skeletons=q;if(E.length>0)$.animations=E;if(O.length>0)$.nodes=O}return $.object=Z,$;function H(Y){let X=[];for(let K in Y){let U=Y[K];delete U.metadata,X.push(U)}return X}}clone(J){return new this.constructor().copy(this,J)}copy(J,Q=!0){if(this.name=J.name,this.up.copy(J.up),this.position.copy(J.position),this.rotation.order=J.rotation.order,this.quaternion.copy(J.quaternion),this.scale.copy(J.scale),this.matrix.copy(J.matrix),this.matrixWorld.copy(J.matrixWorld),this.matrixAutoUpdate=J.matrixAutoUpdate,this.matrixWorldAutoUpdate=J.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=J.matrixWorldNeedsUpdate,this.layers.mask=J.layers.mask,this.visible=J.visible,this.castShadow=J.castShadow,this.receiveShadow=J.receiveShadow,this.frustumCulled=J.frustumCulled,this.renderOrder=J.renderOrder,this.animations=J.animations.slice(),this.userData=JSON.parse(JSON.stringify(J.userData)),Q===!0)for(let $=0;$<J.children.length;$++){let Z=J.children[$];this.add(Z.clone())}return this}}YJ.DEFAULT_UP=new P(0,1,0);YJ.DEFAULT_MATRIX_AUTO_UPDATE=!0;YJ.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var X8=new P,P8=new P,TQ=new P,T8=new P,g9=new P,p9=new P,uZ=new P,AQ=new P,SQ=new P,jQ=new P,yQ=new a0,vQ=new a0,fQ=new a0;class J8{constructor(J=new P,Q=new P,$=new P){this.a=J,this.b=Q,this.c=$}static getNormal(J,Q,$,Z){Z.subVectors($,Q),X8.subVectors(J,Q),Z.cross(X8);let W=Z.lengthSq();if(W>0)return Z.multiplyScalar(1/Math.sqrt(W));return Z.set(0,0,0)}static getBarycoord(J,Q,$,Z,W){X8.subVectors(Z,Q),P8.subVectors($,Q),TQ.subVectors(J,Q);let H=X8.dot(X8),Y=X8.dot(P8),X=X8.dot(TQ),K=P8.dot(P8),U=P8.dot(TQ),G=H*K-Y*Y;if(G===0)return W.set(0,0,0),null;let q=1/G,E=(K*X-Y*U)*q,O=(H*U-Y*X)*q;return W.set(1-E-O,O,E)}static containsPoint(J,Q,$,Z){if(this.getBarycoord(J,Q,$,Z,T8)===null)return!1;return T8.x>=0&&T8.y>=0&&T8.x+T8.y<=1}static getInterpolation(J,Q,$,Z,W,H,Y,X){if(this.getBarycoord(J,Q,$,Z,T8)===null){if(X.x=0,X.y=0,"z"in X)X.z=0;if("w"in X)X.w=0;return null}return X.setScalar(0),X.addScaledVector(W,T8.x),X.addScaledVector(H,T8.y),X.addScaledVector(Y,T8.z),X}static getInterpolatedAttribute(J,Q,$,Z,W,H){return yQ.setScalar(0),vQ.setScalar(0),fQ.setScalar(0),yQ.fromBufferAttribute(J,Q),vQ.fromBufferAttribute(J,$),fQ.fromBufferAttribute(J,Z),H.setScalar(0),H.addScaledVector(yQ,W.x),H.addScaledVector(vQ,W.y),H.addScaledVector(fQ,W.z),H}static isFrontFacing(J,Q,$,Z){return X8.subVectors($,Q),P8.subVectors(J,Q),X8.cross(P8).dot(Z)<0?!0:!1}set(J,Q,$){return this.a.copy(J),this.b.copy(Q),this.c.copy($),this}setFromPointsAndIndices(J,Q,$,Z){return this.a.copy(J[Q]),this.b.copy(J[$]),this.c.copy(J[Z]),this}setFromAttributeAndIndices(J,Q,$,Z){return this.a.fromBufferAttribute(J,Q),this.b.fromBufferAttribute(J,$),this.c.fromBufferAttribute(J,Z),this}clone(){return new this.constructor().copy(this)}copy(J){return this.a.copy(J.a),this.b.copy(J.b),this.c.copy(J.c),this}getArea(){return X8.subVectors(this.c,this.b),P8.subVectors(this.a,this.b),X8.cross(P8).length()*0.5}getMidpoint(J){return J.addVectors(this.a,this.b).add(this.c).multiplyScalar(0.3333333333333333)}getNormal(J){return J8.getNormal(this.a,this.b,this.c,J)}getPlane(J){return J.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(J,Q){return J8.getBarycoord(J,this.a,this.b,this.c,Q)}getInterpolation(J,Q,$,Z,W){return J8.getInterpolation(J,this.a,this.b,this.c,Q,$,Z,W)}containsPoint(J){return J8.containsPoint(J,this.a,this.b,this.c)}isFrontFacing(J){return J8.isFrontFacing(this.a,this.b,this.c,J)}intersectsBox(J){return J.intersectsTriangle(this)}closestPointToPoint(J,Q){let $=this.a,Z=this.b,W=this.c,H,Y;g9.subVectors(Z,$),p9.subVectors(W,$),AQ.subVectors(J,$);let X=g9.dot(AQ),K=p9.dot(AQ);if(X<=0&&K<=0)return Q.copy($);SQ.subVectors(J,Z);let U=g9.dot(SQ),G=p9.dot(SQ);if(U>=0&&G<=U)return Q.copy(Z);let q=X*G-U*K;if(q<=0&&X>=0&&U<=0)return H=X/(X-U),Q.copy($).addScaledVector(g9,H);jQ.subVectors(J,W);let E=g9.dot(jQ),O=p9.dot(jQ);if(O>=0&&E<=O)return Q.copy(W);let D=E*K-X*O;if(D<=0&&K>=0&&O<=0)return Y=K/(K-O),Q.copy($).addScaledVector(p9,Y);let k=U*O-E*G;if(k<=0&&G-U>=0&&E-O>=0)return uZ.subVectors(W,Z),Y=(G-U)/(G-U+(E-O)),Q.copy(Z).addScaledVector(uZ,Y);let N=1/(k+D+q);return H=D*N,Y=q*N,Q.copy($).addScaledVector(g9,H).addScaledVector(p9,Y)}equals(J){return J.a.equals(this.a)&&J.b.equals(this.b)&&J.c.equals(this.c)}}var FH={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},c8={h:0,s:0,l:0},t6={h:0,s:0,l:0};function hQ(J,Q,$){if($<0)$+=1;if($>1)$-=1;if($<0.16666666666666666)return J+(Q-J)*6*$;if($<0.5)return Q;if($<0.6666666666666666)return J+(Q-J)*6*(0.6666666666666666-$);return J}class P0{constructor(J,Q,$){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(J,Q,$)}set(J,Q,$){if(Q===void 0&&$===void 0){let Z=J;if(Z&&Z.isColor)this.copy(Z);else if(typeof Z==="number")this.setHex(Z);else if(typeof Z==="string")this.setStyle(Z)}else this.setRGB(J,Q,$);return this}setScalar(J){return this.r=J,this.g=J,this.b=J,this}setHex(J,Q="srgb"){return J=Math.floor(J),this.r=(J>>16&255)/255,this.g=(J>>8&255)/255,this.b=(J&255)/255,n0.colorSpaceToWorking(this,Q),this}setRGB(J,Q,$,Z=n0.workingColorSpace){return this.r=J,this.g=Q,this.b=$,n0.colorSpaceToWorking(this,Z),this}setHSL(J,Q,$,Z=n0.workingColorSpace){if(J=g$(J,1),Q=d0(Q,0,1),$=d0($,0,1),Q===0)this.r=this.g=this.b=$;else{let W=$<=0.5?$*(1+Q):$+Q-$*Q,H=2*$-W;this.r=hQ(H,W,J+0.3333333333333333),this.g=hQ(H,W,J),this.b=hQ(H,W,J-0.3333333333333333)}return n0.colorSpaceToWorking(this,Z),this}setStyle(J,Q="srgb"){function $(W){if(W===void 0)return;if(parseFloat(W)<1)console.warn("THREE.Color: Alpha component of "+J+" will be ignored.")}let Z;if(Z=/^(\w+)\(([^\)]*)\)/.exec(J)){let W,H=Z[1],Y=Z[2];switch(H){case"rgb":case"rgba":if(W=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(Y))return $(W[4]),this.setRGB(Math.min(255,parseInt(W[1],10))/255,Math.min(255,parseInt(W[2],10))/255,Math.min(255,parseInt(W[3],10))/255,Q);if(W=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(Y))return $(W[4]),this.setRGB(Math.min(100,parseInt(W[1],10))/100,Math.min(100,parseInt(W[2],10))/100,Math.min(100,parseInt(W[3],10))/100,Q);break;case"hsl":case"hsla":if(W=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(Y))return $(W[4]),this.setHSL(parseFloat(W[1])/360,parseFloat(W[2])/100,parseFloat(W[3])/100,Q);break;default:console.warn("THREE.Color: Unknown color model "+J)}}else if(Z=/^\#([A-Fa-f\d]+)$/.exec(J)){let W=Z[1],H=W.length;if(H===3)return this.setRGB(parseInt(W.charAt(0),16)/15,parseInt(W.charAt(1),16)/15,parseInt(W.charAt(2),16)/15,Q);else if(H===6)return this.setHex(parseInt(W,16),Q);else console.warn("THREE.Color: Invalid hex color "+J)}else if(J&&J.length>0)return this.setColorName(J,Q);return this}setColorName(J,Q="srgb"){let $=FH[J.toLowerCase()];if($!==void 0)this.setHex($,Q);else console.warn("THREE.Color: Unknown color "+J);return this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(J){return this.r=J.r,this.g=J.g,this.b=J.b,this}copySRGBToLinear(J){return this.r=S8(J.r),this.g=S8(J.g),this.b=S8(J.b),this}copyLinearToSRGB(J){return this.r=n9(J.r),this.g=n9(J.g),this.b=n9(J.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(J="srgb"){return n0.workingToColorSpace(SJ.copy(this),J),Math.round(d0(SJ.r*255,0,255))*65536+Math.round(d0(SJ.g*255,0,255))*256+Math.round(d0(SJ.b*255,0,255))}getHexString(J="srgb"){return("000000"+this.getHex(J).toString(16)).slice(-6)}getHSL(J,Q=n0.workingColorSpace){n0.workingToColorSpace(SJ.copy(this),Q);let{r:$,g:Z,b:W}=SJ,H=Math.max($,Z,W),Y=Math.min($,Z,W),X,K,U=(Y+H)/2;if(Y===H)X=0,K=0;else{let G=H-Y;switch(K=U<=0.5?G/(H+Y):G/(2-H-Y),H){case $:X=(Z-W)/G+(Z<W?6:0);break;case Z:X=(W-$)/G+2;break;case W:X=($-Z)/G+4;break}X/=6}return J.h=X,J.s=K,J.l=U,J}getRGB(J,Q=n0.workingColorSpace){return n0.workingToColorSpace(SJ.copy(this),Q),J.r=SJ.r,J.g=SJ.g,J.b=SJ.b,J}getStyle(J="srgb"){n0.workingToColorSpace(SJ.copy(this),J);let{r:Q,g:$,b:Z}=SJ;if(J!=="srgb")return`color(${J} ${Q.toFixed(3)} ${$.toFixed(3)} ${Z.toFixed(3)})`;return`rgb(${Math.round(Q*255)},${Math.round($*255)},${Math.round(Z*255)})`}offsetHSL(J,Q,$){return this.getHSL(c8),this.setHSL(c8.h+J,c8.s+Q,c8.l+$)}add(J){return this.r+=J.r,this.g+=J.g,this.b+=J.b,this}addColors(J,Q){return this.r=J.r+Q.r,this.g=J.g+Q.g,this.b=J.b+Q.b,this}addScalar(J){return this.r+=J,this.g+=J,this.b+=J,this}sub(J){return this.r=Math.max(0,this.r-J.r),this.g=Math.max(0,this.g-J.g),this.b=Math.max(0,this.b-J.b),this}multiply(J){return this.r*=J.r,this.g*=J.g,this.b*=J.b,this}multiplyScalar(J){return this.r*=J,this.g*=J,this.b*=J,this}lerp(J,Q){return this.r+=(J.r-this.r)*Q,this.g+=(J.g-this.g)*Q,this.b+=(J.b-this.b)*Q,this}lerpColors(J,Q,$){return this.r=J.r+(Q.r-J.r)*$,this.g=J.g+(Q.g-J.g)*$,this.b=J.b+(Q.b-J.b)*$,this}lerpHSL(J,Q){this.getHSL(c8),J.getHSL(t6);let $=z6(c8.h,t6.h,Q),Z=z6(c8.s,t6.s,Q),W=z6(c8.l,t6.l,Q);return this.setHSL($,Z,W),this}setFromVector3(J){return this.r=J.x,this.g=J.y,this.b=J.z,this}applyMatrix3(J){let Q=this.r,$=this.g,Z=this.b,W=J.elements;return this.r=W[0]*Q+W[3]*$+W[6]*Z,this.g=W[1]*Q+W[4]*$+W[7]*Z,this.b=W[2]*Q+W[5]*$+W[8]*Z,this}equals(J){return J.r===this.r&&J.g===this.g&&J.b===this.b}fromArray(J,Q=0){return this.r=J[Q],this.g=J[Q+1],this.b=J[Q+2],this}toArray(J=[],Q=0){return J[Q]=this.r,J[Q+1]=this.g,J[Q+2]=this.b,J}fromBufferAttribute(J,Q){return this.r=J.getX(Q),this.g=J.getY(Q),this.b=J.getZ(Q),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}var SJ=new P0;P0.NAMES=FH;var CX=0;class sJ extends x8{constructor(){super();this.isMaterial=!0,Object.defineProperty(this,"id",{value:CX++}),this.uuid=G8(),this.name="",this.type="Material",this.blending=1,this.side=0,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=204,this.blendDst=205,this.blendEquation=100,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new P0(0,0,0),this.blendAlpha=0,this.depthFunc=3,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=519,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=7680,this.stencilZFail=7680,this.stencilZPass=7680,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(J){if(this._alphaTest>0!==J>0)this.version++;this._alphaTest=J}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(J){if(J===void 0)return;for(let Q in J){let $=J[Q];if($===void 0){console.warn(`THREE.Material: parameter '${Q}' has value of undefined.`);continue}let Z=this[Q];if(Z===void 0){console.warn(`THREE.Material: '${Q}' is not a property of THREE.${this.type}.`);continue}if(Z&&Z.isColor)Z.set($);else if(Z&&Z.isVector3&&($&&$.isVector3))Z.copy($);else this[Q]=$}}toJSON(J){let Q=J===void 0||typeof J==="string";if(Q)J={textures:{},images:{}};let $={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};if($.uuid=this.uuid,$.type=this.type,this.name!=="")$.name=this.name;if(this.color&&this.color.isColor)$.color=this.color.getHex();if(this.roughness!==void 0)$.roughness=this.roughness;if(this.metalness!==void 0)$.metalness=this.metalness;if(this.sheen!==void 0)$.sheen=this.sheen;if(this.sheenColor&&this.sheenColor.isColor)$.sheenColor=this.sheenColor.getHex();if(this.sheenRoughness!==void 0)$.sheenRoughness=this.sheenRoughness;if(this.emissive&&this.emissive.isColor)$.emissive=this.emissive.getHex();if(this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1)$.emissiveIntensity=this.emissiveIntensity;if(this.specular&&this.specular.isColor)$.specular=this.specular.getHex();if(this.specularIntensity!==void 0)$.specularIntensity=this.specularIntensity;if(this.specularColor&&this.specularColor.isColor)$.specularColor=this.specularColor.getHex();if(this.shininess!==void 0)$.shininess=this.shininess;if(this.clearcoat!==void 0)$.clearcoat=this.clearcoat;if(this.clearcoatRoughness!==void 0)$.clearcoatRoughness=this.clearcoatRoughness;if(this.clearcoatMap&&this.clearcoatMap.isTexture)$.clearcoatMap=this.clearcoatMap.toJSON(J).uuid;if(this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture)$.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(J).uuid;if(this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture)$.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(J).uuid,$.clearcoatNormalScale=this.clearcoatNormalScale.toArray();if(this.sheenColorMap&&this.sheenColorMap.isTexture)$.sheenColorMap=this.sheenColorMap.toJSON(J).uuid;if(this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture)$.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(J).uuid;if(this.dispersion!==void 0)$.dispersion=this.dispersion;if(this.iridescence!==void 0)$.iridescence=this.iridescence;if(this.iridescenceIOR!==void 0)$.iridescenceIOR=this.iridescenceIOR;if(this.iridescenceThicknessRange!==void 0)$.iridescenceThicknessRange=this.iridescenceThicknessRange;if(this.iridescenceMap&&this.iridescenceMap.isTexture)$.iridescenceMap=this.iridescenceMap.toJSON(J).uuid;if(this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture)$.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(J).uuid;if(this.anisotropy!==void 0)$.anisotropy=this.anisotropy;if(this.anisotropyRotation!==void 0)$.anisotropyRotation=this.anisotropyRotation;if(this.anisotropyMap&&this.anisotropyMap.isTexture)$.anisotropyMap=this.anisotropyMap.toJSON(J).uuid;if(this.map&&this.map.isTexture)$.map=this.map.toJSON(J).uuid;if(this.matcap&&this.matcap.isTexture)$.matcap=this.matcap.toJSON(J).uuid;if(this.alphaMap&&this.alphaMap.isTexture)$.alphaMap=this.alphaMap.toJSON(J).uuid;if(this.lightMap&&this.lightMap.isTexture)$.lightMap=this.lightMap.toJSON(J).uuid,$.lightMapIntensity=this.lightMapIntensity;if(this.aoMap&&this.aoMap.isTexture)$.aoMap=this.aoMap.toJSON(J).uuid,$.aoMapIntensity=this.aoMapIntensity;if(this.bumpMap&&this.bumpMap.isTexture)$.bumpMap=this.bumpMap.toJSON(J).uuid,$.bumpScale=this.bumpScale;if(this.normalMap&&this.normalMap.isTexture)$.normalMap=this.normalMap.toJSON(J).uuid,$.normalMapType=this.normalMapType,$.normalScale=this.normalScale.toArray();if(this.displacementMap&&this.displacementMap.isTexture)$.displacementMap=this.displacementMap.toJSON(J).uuid,$.displacementScale=this.displacementScale,$.displacementBias=this.displacementBias;if(this.roughnessMap&&this.roughnessMap.isTexture)$.roughnessMap=this.roughnessMap.toJSON(J).uuid;if(this.metalnessMap&&this.metalnessMap.isTexture)$.metalnessMap=this.metalnessMap.toJSON(J).uuid;if(this.emissiveMap&&this.emissiveMap.isTexture)$.emissiveMap=this.emissiveMap.toJSON(J).uuid;if(this.specularMap&&this.specularMap.isTexture)$.specularMap=this.specularMap.toJSON(J).uuid;if(this.specularIntensityMap&&this.specularIntensityMap.isTexture)$.specularIntensityMap=this.specularIntensityMap.toJSON(J).uuid;if(this.specularColorMap&&this.specularColorMap.isTexture)$.specularColorMap=this.specularColorMap.toJSON(J).uuid;if(this.envMap&&this.envMap.isTexture){if($.envMap=this.envMap.toJSON(J).uuid,this.combine!==void 0)$.combine=this.combine}if(this.envMapRotation!==void 0)$.envMapRotation=this.envMapRotation.toArray();if(this.envMapIntensity!==void 0)$.envMapIntensity=this.envMapIntensity;if(this.reflectivity!==void 0)$.reflectivity=this.reflectivity;if(this.refractionRatio!==void 0)$.refractionRatio=this.refractionRatio;if(this.gradientMap&&this.gradientMap.isTexture)$.gradientMap=this.gradientMap.toJSON(J).uuid;if(this.transmission!==void 0)$.transmission=this.transmission;if(this.transmissionMap&&this.transmissionMap.isTexture)$.transmissionMap=this.transmissionMap.toJSON(J).uuid;if(this.thickness!==void 0)$.thickness=this.thickness;if(this.thicknessMap&&this.thicknessMap.isTexture)$.thicknessMap=this.thicknessMap.toJSON(J).uuid;if(this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0)$.attenuationDistance=this.attenuationDistance;if(this.attenuationColor!==void 0)$.attenuationColor=this.attenuationColor.getHex();if(this.size!==void 0)$.size=this.size;if(this.shadowSide!==null)$.shadowSide=this.shadowSide;if(this.sizeAttenuation!==void 0)$.sizeAttenuation=this.sizeAttenuation;if(this.blending!==1)$.blending=this.blending;if(this.side!==0)$.side=this.side;if(this.vertexColors===!0)$.vertexColors=!0;if(this.opacity<1)$.opacity=this.opacity;if(this.transparent===!0)$.transparent=!0;if(this.blendSrc!==204)$.blendSrc=this.blendSrc;if(this.blendDst!==205)$.blendDst=this.blendDst;if(this.blendEquation!==100)$.blendEquation=this.blendEquation;if(this.blendSrcAlpha!==null)$.blendSrcAlpha=this.blendSrcAlpha;if(this.blendDstAlpha!==null)$.blendDstAlpha=this.blendDstAlpha;if(this.blendEquationAlpha!==null)$.blendEquationAlpha=this.blendEquationAlpha;if(this.blendColor&&this.blendColor.isColor)$.blendColor=this.blendColor.getHex();if(this.blendAlpha!==0)$.blendAlpha=this.blendAlpha;if(this.depthFunc!==3)$.depthFunc=this.depthFunc;if(this.depthTest===!1)$.depthTest=this.depthTest;if(this.depthWrite===!1)$.depthWrite=this.depthWrite;if(this.colorWrite===!1)$.colorWrite=this.colorWrite;if(this.stencilWriteMask!==255)$.stencilWriteMask=this.stencilWriteMask;if(this.stencilFunc!==519)$.stencilFunc=this.stencilFunc;if(this.stencilRef!==0)$.stencilRef=this.stencilRef;if(this.stencilFuncMask!==255)$.stencilFuncMask=this.stencilFuncMask;if(this.stencilFail!==7680)$.stencilFail=this.stencilFail;if(this.stencilZFail!==7680)$.stencilZFail=this.stencilZFail;if(this.stencilZPass!==7680)$.stencilZPass=this.stencilZPass;if(this.stencilWrite===!0)$.stencilWrite=this.stencilWrite;if(this.rotation!==void 0&&this.rotation!==0)$.rotation=this.rotation;if(this.polygonOffset===!0)$.polygonOffset=!0;if(this.polygonOffsetFactor!==0)$.polygonOffsetFactor=this.polygonOffsetFactor;if(this.polygonOffsetUnits!==0)$.polygonOffsetUnits=this.polygonOffsetUnits;if(this.linewidth!==void 0&&this.linewidth!==1)$.linewidth=this.linewidth;if(this.dashSize!==void 0)$.dashSize=this.dashSize;if(this.gapSize!==void 0)$.gapSize=this.gapSize;if(this.scale!==void 0)$.scale=this.scale;if(this.dithering===!0)$.dithering=!0;if(this.alphaTest>0)$.alphaTest=this.alphaTest;if(this.alphaHash===!0)$.alphaHash=!0;if(this.alphaToCoverage===!0)$.alphaToCoverage=!0;if(this.premultipliedAlpha===!0)$.premultipliedAlpha=!0;if(this.forceSinglePass===!0)$.forceSinglePass=!0;if(this.wireframe===!0)$.wireframe=!0;if(this.wireframeLinewidth>1)$.wireframeLinewidth=this.wireframeLinewidth;if(this.wireframeLinecap!=="round")$.wireframeLinecap=this.wireframeLinecap;if(this.wireframeLinejoin!=="round")$.wireframeLinejoin=this.wireframeLinejoin;if(this.flatShading===!0)$.flatShading=!0;if(this.visible===!1)$.visible=!1;if(this.toneMapped===!1)$.toneMapped=!1;if(this.fog===!1)$.fog=!1;if(Object.keys(this.userData).length>0)$.userData=this.userData;function Z(W){let H=[];for(let Y in W){let X=W[Y];delete X.metadata,H.push(X)}return H}if(Q){let W=Z(J.textures),H=Z(J.images);if(W.length>0)$.textures=W;if(H.length>0)$.images=H}return $}clone(){return new this.constructor().copy(this)}copy(J){this.name=J.name,this.blending=J.blending,this.side=J.side,this.vertexColors=J.vertexColors,this.opacity=J.opacity,this.transparent=J.transparent,this.blendSrc=J.blendSrc,this.blendDst=J.blendDst,this.blendEquation=J.blendEquation,this.blendSrcAlpha=J.blendSrcAlpha,this.blendDstAlpha=J.blendDstAlpha,this.blendEquationAlpha=J.blendEquationAlpha,this.blendColor.copy(J.blendColor),this.blendAlpha=J.blendAlpha,this.depthFunc=J.depthFunc,this.depthTest=J.depthTest,this.depthWrite=J.depthWrite,this.stencilWriteMask=J.stencilWriteMask,this.stencilFunc=J.stencilFunc,this.stencilRef=J.stencilRef,this.stencilFuncMask=J.stencilFuncMask,this.stencilFail=J.stencilFail,this.stencilZFail=J.stencilZFail,this.stencilZPass=J.stencilZPass,this.stencilWrite=J.stencilWrite;let Q=J.clippingPlanes,$=null;if(Q!==null){let Z=Q.length;$=Array(Z);for(let W=0;W!==Z;++W)$[W]=Q[W].clone()}return this.clippingPlanes=$,this.clipIntersection=J.clipIntersection,this.clipShadows=J.clipShadows,this.shadowSide=J.shadowSide,this.colorWrite=J.colorWrite,this.precision=J.precision,this.polygonOffset=J.polygonOffset,this.polygonOffsetFactor=J.polygonOffsetFactor,this.polygonOffsetUnits=J.polygonOffsetUnits,this.dithering=J.dithering,this.alphaTest=J.alphaTest,this.alphaHash=J.alphaHash,this.alphaToCoverage=J.alphaToCoverage,this.premultipliedAlpha=J.premultipliedAlpha,this.forceSinglePass=J.forceSinglePass,this.visible=J.visible,this.toneMapped=J.toneMapped,this.userData=JSON.parse(JSON.stringify(J.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(J){if(J===!0)this.version++}}class Z8 extends sJ{constructor(J){super();this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new P0(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new q8,this.combine=0,this.reflectivity=1,this.refractionRatio=0.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(J)}copy(J){return super.copy(J),this.color.copy(J.color),this.map=J.map,this.lightMap=J.lightMap,this.lightMapIntensity=J.lightMapIntensity,this.aoMap=J.aoMap,this.aoMapIntensity=J.aoMapIntensity,this.specularMap=J.specularMap,this.alphaMap=J.alphaMap,this.envMap=J.envMap,this.envMapRotation.copy(J.envMapRotation),this.combine=J.combine,this.reflectivity=J.reflectivity,this.refractionRatio=J.refractionRatio,this.wireframe=J.wireframe,this.wireframeLinewidth=J.wireframeLinewidth,this.wireframeLinecap=J.wireframeLinecap,this.wireframeLinejoin=J.wireframeLinejoin,this.fog=J.fog,this}}var DJ=new P,e6=new _0,_X=0;class MJ{constructor(J,Q,$=!1){if(Array.isArray(J))throw TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:_X++}),this.name="",this.array=J,this.itemSize=Q,this.count=J!==void 0?J.length/Q:0,this.normalized=$,this.usage=35044,this.updateRanges=[],this.gpuType=1015,this.version=0}onUploadCallback(){}set needsUpdate(J){if(J===!0)this.version++}setUsage(J){return this.usage=J,this}addUpdateRange(J,Q){this.updateRanges.push({start:J,count:Q})}clearUpdateRanges(){this.updateRanges.length=0}copy(J){return this.name=J.name,this.array=new J.array.constructor(J.array),this.itemSize=J.itemSize,this.count=J.count,this.normalized=J.normalized,this.usage=J.usage,this.gpuType=J.gpuType,this}copyAt(J,Q,$){J*=this.itemSize,$*=Q.itemSize;for(let Z=0,W=this.itemSize;Z<W;Z++)this.array[J+Z]=Q.array[$+Z];return this}copyArray(J){return this.array.set(J),this}applyMatrix3(J){if(this.itemSize===2)for(let Q=0,$=this.count;Q<$;Q++)e6.fromBufferAttribute(this,Q),e6.applyMatrix3(J),this.setXY(Q,e6.x,e6.y);else if(this.itemSize===3)for(let Q=0,$=this.count;Q<$;Q++)DJ.fromBufferAttribute(this,Q),DJ.applyMatrix3(J),this.setXYZ(Q,DJ.x,DJ.y,DJ.z);return this}applyMatrix4(J){for(let Q=0,$=this.count;Q<$;Q++)DJ.fromBufferAttribute(this,Q),DJ.applyMatrix4(J),this.setXYZ(Q,DJ.x,DJ.y,DJ.z);return this}applyNormalMatrix(J){for(let Q=0,$=this.count;Q<$;Q++)DJ.fromBufferAttribute(this,Q),DJ.applyNormalMatrix(J),this.setXYZ(Q,DJ.x,DJ.y,DJ.z);return this}transformDirection(J){for(let Q=0,$=this.count;Q<$;Q++)DJ.fromBufferAttribute(this,Q),DJ.transformDirection(J),this.setXYZ(Q,DJ.x,DJ.y,DJ.z);return this}set(J,Q=0){return this.array.set(J,Q),this}getComponent(J,Q){let $=this.array[J*this.itemSize+Q];if(this.normalized)$=U8($,this.array);return $}setComponent(J,Q,$){if(this.normalized)$=e0($,this.array);return this.array[J*this.itemSize+Q]=$,this}getX(J){let Q=this.array[J*this.itemSize];if(this.normalized)Q=U8(Q,this.array);return Q}setX(J,Q){if(this.normalized)Q=e0(Q,this.array);return this.array[J*this.itemSize]=Q,this}getY(J){let Q=this.array[J*this.itemSize+1];if(this.normalized)Q=U8(Q,this.array);return Q}setY(J,Q){if(this.normalized)Q=e0(Q,this.array);return this.array[J*this.itemSize+1]=Q,this}getZ(J){let Q=this.array[J*this.itemSize+2];if(this.normalized)Q=U8(Q,this.array);return Q}setZ(J,Q){if(this.normalized)Q=e0(Q,this.array);return this.array[J*this.itemSize+2]=Q,this}getW(J){let Q=this.array[J*this.itemSize+3];if(this.normalized)Q=U8(Q,this.array);return Q}setW(J,Q){if(this.normalized)Q=e0(Q,this.array);return this.array[J*this.itemSize+3]=Q,this}setXY(J,Q,$){if(J*=this.itemSize,this.normalized)Q=e0(Q,this.array),$=e0($,this.array);return this.array[J+0]=Q,this.array[J+1]=$,this}setXYZ(J,Q,$,Z){if(J*=this.itemSize,this.normalized)Q=e0(Q,this.array),$=e0($,this.array),Z=e0(Z,this.array);return this.array[J+0]=Q,this.array[J+1]=$,this.array[J+2]=Z,this}setXYZW(J,Q,$,Z,W){if(J*=this.itemSize,this.normalized)Q=e0(Q,this.array),$=e0($,this.array),Z=e0(Z,this.array),W=e0(W,this.array);return this.array[J+0]=Q,this.array[J+1]=$,this.array[J+2]=Z,this.array[J+3]=W,this}onUpload(J){return this.onUploadCallback=J,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let J={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};if(this.name!=="")J.name=this.name;if(this.usage!==35044)J.usage=this.usage;return J}}class b7 extends MJ{constructor(J,Q,$){super(new Uint16Array(J),Q,$)}}class g7 extends MJ{constructor(J,Q,$){super(new Uint32Array(J),Q,$)}}class Q8 extends MJ{constructor(J,Q,$){super(new Float32Array(J),Q,$)}}var wX=0,eJ=new j0,xQ=new YJ,l9=new P,mJ=new wJ,R6=new wJ,_J=new P;class oJ extends x8{constructor(){super();this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:wX++}),this.uuid=G8(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(J){if(Array.isArray(J))this.index=new((p$(J))?g7:b7)(J,1);else this.index=J;return this}setIndirect(J){return this.indirect=J,this}getIndirect(){return this.indirect}getAttribute(J){return this.attributes[J]}setAttribute(J,Q){return this.attributes[J]=Q,this}deleteAttribute(J){return delete this.attributes[J],this}hasAttribute(J){return this.attributes[J]!==void 0}addGroup(J,Q,$=0){this.groups.push({start:J,count:Q,materialIndex:$})}clearGroups(){this.groups=[]}setDrawRange(J,Q){this.drawRange.start=J,this.drawRange.count=Q}applyMatrix4(J){let Q=this.attributes.position;if(Q!==void 0)Q.applyMatrix4(J),Q.needsUpdate=!0;let $=this.attributes.normal;if($!==void 0){let W=new f0().getNormalMatrix(J);$.applyNormalMatrix(W),$.needsUpdate=!0}let Z=this.attributes.tangent;if(Z!==void 0)Z.transformDirection(J),Z.needsUpdate=!0;if(this.boundingBox!==null)this.computeBoundingBox();if(this.boundingSphere!==null)this.computeBoundingSphere();return this}applyQuaternion(J){return eJ.makeRotationFromQuaternion(J),this.applyMatrix4(eJ),this}rotateX(J){return eJ.makeRotationX(J),this.applyMatrix4(eJ),this}rotateY(J){return eJ.makeRotationY(J),this.applyMatrix4(eJ),this}rotateZ(J){return eJ.makeRotationZ(J),this.applyMatrix4(eJ),this}translate(J,Q,$){return eJ.makeTranslation(J,Q,$),this.applyMatrix4(eJ),this}scale(J,Q,$){return eJ.makeScale(J,Q,$),this.applyMatrix4(eJ),this}lookAt(J){return xQ.lookAt(J),xQ.updateMatrix(),this.applyMatrix4(xQ.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(l9).negate(),this.translate(l9.x,l9.y,l9.z),this}setFromPoints(J){let Q=this.getAttribute("position");if(Q===void 0){let $=[];for(let Z=0,W=J.length;Z<W;Z++){let H=J[Z];$.push(H.x,H.y,H.z||0)}this.setAttribute("position",new Q8($,3))}else{let $=Math.min(J.length,Q.count);for(let Z=0;Z<$;Z++){let W=J[Z];Q.setXYZ(Z,W.x,W.y,W.z||0)}if(J.length>Q.count)console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry.");Q.needsUpdate=!0}return this}computeBoundingBox(){if(this.boundingBox===null)this.boundingBox=new wJ;let J=this.attributes.position,Q=this.morphAttributes.position;if(J&&J.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new P(-1/0,-1/0,-1/0),new P(1/0,1/0,1/0));return}if(J!==void 0){if(this.boundingBox.setFromBufferAttribute(J),Q)for(let $=0,Z=Q.length;$<Z;$++){let W=Q[$];if(mJ.setFromBufferAttribute(W),this.morphTargetsRelative)_J.addVectors(this.boundingBox.min,mJ.min),this.boundingBox.expandByPoint(_J),_J.addVectors(this.boundingBox.max,mJ.max),this.boundingBox.expandByPoint(_J);else this.boundingBox.expandByPoint(mJ.min),this.boundingBox.expandByPoint(mJ.max)}}else this.boundingBox.makeEmpty();if(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){if(this.boundingSphere===null)this.boundingSphere=new nJ;let J=this.attributes.position,Q=this.morphAttributes.position;if(J&&J.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new P,1/0);return}if(J){let $=this.boundingSphere.center;if(mJ.setFromBufferAttribute(J),Q)for(let W=0,H=Q.length;W<H;W++){let Y=Q[W];if(R6.setFromBufferAttribute(Y),this.morphTargetsRelative)_J.addVectors(mJ.min,R6.min),mJ.expandByPoint(_J),_J.addVectors(mJ.max,R6.max),mJ.expandByPoint(_J);else mJ.expandByPoint(R6.min),mJ.expandByPoint(R6.max)}mJ.getCenter($);let Z=0;for(let W=0,H=J.count;W<H;W++)_J.fromBufferAttribute(J,W),Z=Math.max(Z,$.distanceToSquared(_J));if(Q)for(let W=0,H=Q.length;W<H;W++){let Y=Q[W],X=this.morphTargetsRelative;for(let K=0,U=Y.count;K<U;K++){if(_J.fromBufferAttribute(Y,K),X)l9.fromBufferAttribute(J,K),_J.add(l9);Z=Math.max(Z,$.distanceToSquared(_J))}}if(this.boundingSphere.radius=Math.sqrt(Z),isNaN(this.boundingSphere.radius))console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let J=this.index,Q=this.attributes;if(J===null||Q.position===void 0||Q.normal===void 0||Q.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let{position:$,normal:Z,uv:W}=Q;if(this.hasAttribute("tangent")===!1)this.setAttribute("tangent",new MJ(new Float32Array(4*$.count),4));let H=this.getAttribute("tangent"),Y=[],X=[];for(let S=0;S<$.count;S++)Y[S]=new P,X[S]=new P;let K=new P,U=new P,G=new P,q=new _0,E=new _0,O=new _0,D=new P,k=new P;function N(S,p,z){K.fromBufferAttribute($,S),U.fromBufferAttribute($,p),G.fromBufferAttribute($,z),q.fromBufferAttribute(W,S),E.fromBufferAttribute(W,p),O.fromBufferAttribute(W,z),U.sub(K),G.sub(K),E.sub(q),O.sub(q);let V=1/(E.x*O.y-O.x*E.y);if(!isFinite(V))return;D.copy(U).multiplyScalar(O.y).addScaledVector(G,-E.y).multiplyScalar(V),k.copy(G).multiplyScalar(E.x).addScaledVector(U,-O.x).multiplyScalar(V),Y[S].add(D),Y[p].add(D),Y[z].add(D),X[S].add(k),X[p].add(k),X[z].add(k)}let F=this.groups;if(F.length===0)F=[{start:0,count:J.count}];for(let S=0,p=F.length;S<p;++S){let z=F[S],V=z.start,A=z.count;for(let m=V,c=V+A;m<c;m+=3)N(J.getX(m+0),J.getX(m+1),J.getX(m+2))}let C=new P,L=new P,_=new P,j=new P;function w(S){_.fromBufferAttribute(Z,S),j.copy(_);let p=Y[S];C.copy(p),C.sub(_.multiplyScalar(_.dot(p))).normalize(),L.crossVectors(j,p);let V=L.dot(X[S])<0?-1:1;H.setXYZW(S,C.x,C.y,C.z,V)}for(let S=0,p=F.length;S<p;++S){let z=F[S],V=z.start,A=z.count;for(let m=V,c=V+A;m<c;m+=3)w(J.getX(m+0)),w(J.getX(m+1)),w(J.getX(m+2))}}computeVertexNormals(){let J=this.index,Q=this.getAttribute("position");if(Q!==void 0){let $=this.getAttribute("normal");if($===void 0)$=new MJ(new Float32Array(Q.count*3),3),this.setAttribute("normal",$);else for(let q=0,E=$.count;q<E;q++)$.setXYZ(q,0,0,0);let Z=new P,W=new P,H=new P,Y=new P,X=new P,K=new P,U=new P,G=new P;if(J)for(let q=0,E=J.count;q<E;q+=3){let O=J.getX(q+0),D=J.getX(q+1),k=J.getX(q+2);Z.fromBufferAttribute(Q,O),W.fromBufferAttribute(Q,D),H.fromBufferAttribute(Q,k),U.subVectors(H,W),G.subVectors(Z,W),U.cross(G),Y.fromBufferAttribute($,O),X.fromBufferAttribute($,D),K.fromBufferAttribute($,k),Y.add(U),X.add(U),K.add(U),$.setXYZ(O,Y.x,Y.y,Y.z),$.setXYZ(D,X.x,X.y,X.z),$.setXYZ(k,K.x,K.y,K.z)}else for(let q=0,E=Q.count;q<E;q+=3)Z.fromBufferAttribute(Q,q+0),W.fromBufferAttribute(Q,q+1),H.fromBufferAttribute(Q,q+2),U.subVectors(H,W),G.subVectors(Z,W),U.cross(G),$.setXYZ(q+0,U.x,U.y,U.z),$.setXYZ(q+1,U.x,U.y,U.z),$.setXYZ(q+2,U.x,U.y,U.z);this.normalizeNormals(),$.needsUpdate=!0}}normalizeNormals(){let J=this.attributes.normal;for(let Q=0,$=J.count;Q<$;Q++)_J.fromBufferAttribute(J,Q),_J.normalize(),J.setXYZ(Q,_J.x,_J.y,_J.z)}toNonIndexed(){function J(Y,X){let{array:K,itemSize:U,normalized:G}=Y,q=new K.constructor(X.length*U),E=0,O=0;for(let D=0,k=X.length;D<k;D++){if(Y.isInterleavedBufferAttribute)E=X[D]*Y.data.stride+Y.offset;else E=X[D]*U;for(let N=0;N<U;N++)q[O++]=K[E++]}return new MJ(q,U,G)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let Q=new oJ,$=this.index.array,Z=this.attributes;for(let Y in Z){let X=Z[Y],K=J(X,$);Q.setAttribute(Y,K)}let W=this.morphAttributes;for(let Y in W){let X=[],K=W[Y];for(let U=0,G=K.length;U<G;U++){let q=K[U],E=J(q,$);X.push(E)}Q.morphAttributes[Y]=X}Q.morphTargetsRelative=this.morphTargetsRelative;let H=this.groups;for(let Y=0,X=H.length;Y<X;Y++){let K=H[Y];Q.addGroup(K.start,K.count,K.materialIndex)}return Q}toJSON(){let J={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(J.uuid=this.uuid,J.type=this.type,this.name!=="")J.name=this.name;if(Object.keys(this.userData).length>0)J.userData=this.userData;if(this.parameters!==void 0){let X=this.parameters;for(let K in X)if(X[K]!==void 0)J[K]=X[K];return J}J.data={attributes:{}};let Q=this.index;if(Q!==null)J.data.index={type:Q.array.constructor.name,array:Array.prototype.slice.call(Q.array)};let $=this.attributes;for(let X in $){let K=$[X];J.data.attributes[X]=K.toJSON(J.data)}let Z={},W=!1;for(let X in this.morphAttributes){let K=this.morphAttributes[X],U=[];for(let G=0,q=K.length;G<q;G++){let E=K[G];U.push(E.toJSON(J.data))}if(U.length>0)Z[X]=U,W=!0}if(W)J.data.morphAttributes=Z,J.data.morphTargetsRelative=this.morphTargetsRelative;let H=this.groups;if(H.length>0)J.data.groups=JSON.parse(JSON.stringify(H));let Y=this.boundingSphere;if(Y!==null)J.data.boundingSphere=Y.toJSON();return J}clone(){return new this.constructor().copy(this)}copy(J){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let Q={};this.name=J.name;let $=J.index;if($!==null)this.setIndex($.clone());let Z=J.attributes;for(let K in Z){let U=Z[K];this.setAttribute(K,U.clone(Q))}let W=J.morphAttributes;for(let K in W){let U=[],G=W[K];for(let q=0,E=G.length;q<E;q++)U.push(G[q].clone(Q));this.morphAttributes[K]=U}this.morphTargetsRelative=J.morphTargetsRelative;let H=J.groups;for(let K=0,U=H.length;K<U;K++){let G=H[K];this.addGroup(G.start,G.count,G.materialIndex)}let Y=J.boundingBox;if(Y!==null)this.boundingBox=Y.clone();let X=J.boundingSphere;if(X!==null)this.boundingSphere=X.clone();return this.drawRange.start=J.drawRange.start,this.drawRange.count=J.drawRange.count,this.userData=J.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}var cZ=new j0,E9=new F8,J7=new nJ,nZ=new P,Q7=new P,$7=new P,Z7=new P,bQ=new P,W7=new P,sZ=new P,H7=new P;class IJ extends YJ{constructor(J=new oJ,Q=new Z8){super();this.isMesh=!0,this.type="Mesh",this.geometry=J,this.material=Q,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(J,Q){if(super.copy(J,Q),J.morphTargetInfluences!==void 0)this.morphTargetInfluences=J.morphTargetInfluences.slice();if(J.morphTargetDictionary!==void 0)this.morphTargetDictionary=Object.assign({},J.morphTargetDictionary);return this.material=Array.isArray(J.material)?J.material.slice():J.material,this.geometry=J.geometry,this}updateMorphTargets(){let Q=this.geometry.morphAttributes,$=Object.keys(Q);if($.length>0){let Z=Q[$[0]];if(Z!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let W=0,H=Z.length;W<H;W++){let Y=Z[W].name||String(W);this.morphTargetInfluences.push(0),this.morphTargetDictionary[Y]=W}}}}getVertexPosition(J,Q){let $=this.geometry,Z=$.attributes.position,W=$.morphAttributes.position,H=$.morphTargetsRelative;Q.fromBufferAttribute(Z,J);let Y=this.morphTargetInfluences;if(W&&Y){W7.set(0,0,0);for(let X=0,K=W.length;X<K;X++){let U=Y[X],G=W[X];if(U===0)continue;if(bQ.fromBufferAttribute(G,J),H)W7.addScaledVector(bQ,U);else W7.addScaledVector(bQ.sub(Q),U)}Q.add(W7)}return Q}raycast(J,Q){let $=this.geometry,Z=this.material,W=this.matrixWorld;if(Z===void 0)return;if($.boundingSphere===null)$.computeBoundingSphere();if(J7.copy($.boundingSphere),J7.applyMatrix4(W),E9.copy(J.ray).recast(J.near),J7.containsPoint(E9.origin)===!1){if(E9.intersectSphere(J7,nZ)===null)return;if(E9.origin.distanceToSquared(nZ)>(J.far-J.near)**2)return}if(cZ.copy(W).invert(),E9.copy(J.ray).applyMatrix4(cZ),$.boundingBox!==null){if(E9.intersectsBox($.boundingBox)===!1)return}this._computeIntersections(J,Q,E9)}_computeIntersections(J,Q,$){let Z,W=this.geometry,H=this.material,Y=W.index,X=W.attributes.position,K=W.attributes.uv,U=W.attributes.uv1,G=W.attributes.normal,q=W.groups,E=W.drawRange;if(Y!==null)if(Array.isArray(H))for(let O=0,D=q.length;O<D;O++){let k=q[O],N=H[k.materialIndex],F=Math.max(k.start,E.start),C=Math.min(Y.count,Math.min(k.start+k.count,E.start+E.count));for(let L=F,_=C;L<_;L+=3){let j=Y.getX(L),w=Y.getX(L+1),S=Y.getX(L+2);if(Z=Y7(this,N,J,$,K,U,G,j,w,S),Z)Z.faceIndex=Math.floor(L/3),Z.face.materialIndex=k.materialIndex,Q.push(Z)}}else{let O=Math.max(0,E.start),D=Math.min(Y.count,E.start+E.count);for(let k=O,N=D;k<N;k+=3){let F=Y.getX(k),C=Y.getX(k+1),L=Y.getX(k+2);if(Z=Y7(this,H,J,$,K,U,G,F,C,L),Z)Z.faceIndex=Math.floor(k/3),Q.push(Z)}}else if(X!==void 0)if(Array.isArray(H))for(let O=0,D=q.length;O<D;O++){let k=q[O],N=H[k.materialIndex],F=Math.max(k.start,E.start),C=Math.min(X.count,Math.min(k.start+k.count,E.start+E.count));for(let L=F,_=C;L<_;L+=3){let j=L,w=L+1,S=L+2;if(Z=Y7(this,N,J,$,K,U,G,j,w,S),Z)Z.faceIndex=Math.floor(L/3),Z.face.materialIndex=k.materialIndex,Q.push(Z)}}else{let O=Math.max(0,E.start),D=Math.min(X.count,E.start+E.count);for(let k=O,N=D;k<N;k+=3){let F=k,C=k+1,L=k+2;if(Z=Y7(this,H,J,$,K,U,G,F,C,L),Z)Z.faceIndex=Math.floor(k/3),Q.push(Z)}}}}function IX(J,Q,$,Z,W,H,Y,X){let K;if(Q.side===1)K=Z.intersectTriangle(Y,H,W,!0,X);else K=Z.intersectTriangle(W,H,Y,Q.side===0,X);if(K===null)return null;H7.copy(X),H7.applyMatrix4(J.matrixWorld);let U=$.ray.origin.distanceTo(H7);if(U<$.near||U>$.far)return null;return{distance:U,point:H7.clone(),object:J}}function Y7(J,Q,$,Z,W,H,Y,X,K,U){J.getVertexPosition(X,Q7),J.getVertexPosition(K,$7),J.getVertexPosition(U,Z7);let G=IX(J,Q,$,Z,Q7,$7,Z7,sZ);if(G){let q=new P;if(J8.getBarycoord(sZ,Q7,$7,Z7,q),W)G.uv=J8.getInterpolatedAttribute(W,X,K,U,q,new _0);if(H)G.uv1=J8.getInterpolatedAttribute(H,X,K,U,q,new _0);if(Y){if(G.normal=J8.getInterpolatedAttribute(Y,X,K,U,q,new P),G.normal.dot(Z.direction)>0)G.normal.multiplyScalar(-1)}let E={a:X,b:K,c:U,normal:new P,materialIndex:0};J8.getNormal(Q7,$7,Z7,E.normal),G.face=E,G.barycoord=q}return G}class $6 extends oJ{constructor(J=1,Q=1,$=1,Z=1,W=1,H=1){super();this.type="BoxGeometry",this.parameters={width:J,height:Q,depth:$,widthSegments:Z,heightSegments:W,depthSegments:H};let Y=this;Z=Math.floor(Z),W=Math.floor(W),H=Math.floor(H);let X=[],K=[],U=[],G=[],q=0,E=0;O("z","y","x",-1,-1,$,Q,J,H,W,0),O("z","y","x",1,-1,$,Q,-J,H,W,1),O("x","z","y",1,1,J,$,Q,Z,H,2),O("x","z","y",1,-1,J,$,-Q,Z,H,3),O("x","y","z",1,-1,J,Q,$,Z,W,4),O("x","y","z",-1,-1,J,Q,-$,Z,W,5),this.setIndex(X),this.setAttribute("position",new Q8(K,3)),this.setAttribute("normal",new Q8(U,3)),this.setAttribute("uv",new Q8(G,2));function O(D,k,N,F,C,L,_,j,w,S,p){let z=L/w,V=_/S,A=L/2,m=_/2,c=j/2,l=w+1,i=S+1,u=0,r=0,b=new P;for(let X0=0;X0<i;X0++){let g=X0*V-m;for(let $0=0;$0<l;$0++){let w0=$0*z-A;b[D]=w0*F,b[k]=g*C,b[N]=c,K.push(b.x,b.y,b.z),b[D]=0,b[k]=0,b[N]=j>0?1:-1,U.push(b.x,b.y,b.z),G.push($0/w),G.push(1-X0/S),u+=1}}for(let X0=0;X0<S;X0++)for(let g=0;g<w;g++){let $0=q+g+l*X0,w0=q+g+l*(X0+1),u0=q+(g+1)+l*(X0+1),s0=q+(g+1)+l*X0;X.push($0,w0,s0),X.push(w0,u0,s0),r+=6}Y.addGroup(E,r,p),E+=r,q+=u}}copy(J){return super.copy(J),this.parameters=Object.assign({},J.parameters),this}static fromJSON(J){return new $6(J.width,J.height,J.depth,J.widthSegments,J.heightSegments,J.depthSegments)}}function M9(J){let Q={};for(let $ in J){Q[$]={};for(let Z in J[$]){let W=J[$][Z];if(W&&(W.isColor||W.isMatrix3||W.isMatrix4||W.isVector2||W.isVector3||W.isVector4||W.isTexture||W.isQuaternion))if(W.isRenderTargetTexture)console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),Q[$][Z]=null;else Q[$][Z]=W.clone();else if(Array.isArray(W))Q[$][Z]=W.slice();else Q[$][Z]=W}}return Q}function yJ(J){let Q={};for(let $=0;$<J.length;$++){let Z=M9(J[$]);for(let W in Z)Q[W]=Z[W]}return Q}function PX(J){let Q=[];for(let $=0;$<J.length;$++)Q.push(J[$].clone());return Q}function u$(J){let Q=J.getRenderTarget();if(Q===null)return J.outputColorSpace;if(Q.isXRRenderTarget===!0)return Q.texture.colorSpace;return n0.workingColorSpace}var OH={clone:M9,merge:yJ},TX=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,AX=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class z8 extends sJ{constructor(J){super();if(this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=TX,this.fragmentShader=AX,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,J!==void 0)this.setValues(J)}copy(J){return super.copy(J),this.fragmentShader=J.fragmentShader,this.vertexShader=J.vertexShader,this.uniforms=M9(J.uniforms),this.uniformsGroups=PX(J.uniformsGroups),this.defines=Object.assign({},J.defines),this.wireframe=J.wireframe,this.wireframeLinewidth=J.wireframeLinewidth,this.fog=J.fog,this.lights=J.lights,this.clipping=J.clipping,this.extensions=Object.assign({},J.extensions),this.glslVersion=J.glslVersion,this}toJSON(J){let Q=super.toJSON(J);Q.glslVersion=this.glslVersion,Q.uniforms={};for(let Z in this.uniforms){let H=this.uniforms[Z].value;if(H&&H.isTexture)Q.uniforms[Z]={type:"t",value:H.toJSON(J).uuid};else if(H&&H.isColor)Q.uniforms[Z]={type:"c",value:H.getHex()};else if(H&&H.isVector2)Q.uniforms[Z]={type:"v2",value:H.toArray()};else if(H&&H.isVector3)Q.uniforms[Z]={type:"v3",value:H.toArray()};else if(H&&H.isVector4)Q.uniforms[Z]={type:"v4",value:H.toArray()};else if(H&&H.isMatrix3)Q.uniforms[Z]={type:"m3",value:H.toArray()};else if(H&&H.isMatrix4)Q.uniforms[Z]={type:"m4",value:H.toArray()};else Q.uniforms[Z]={value:H}}if(Object.keys(this.defines).length>0)Q.defines=this.defines;Q.vertexShader=this.vertexShader,Q.fragmentShader=this.fragmentShader,Q.lights=this.lights,Q.clipping=this.clipping;let $={};for(let Z in this.extensions)if(this.extensions[Z]===!0)$[Z]=!0;if(Object.keys($).length>0)Q.extensions=$;return Q}}class p7 extends YJ{constructor(){super();this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new j0,this.projectionMatrix=new j0,this.projectionMatrixInverse=new j0,this.coordinateSystem=2000,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(J,Q){return super.copy(J,Q),this.matrixWorldInverse.copy(J.matrixWorldInverse),this.projectionMatrix.copy(J.projectionMatrix),this.projectionMatrixInverse.copy(J.projectionMatrixInverse),this.coordinateSystem=J.coordinateSystem,this}getWorldDirection(J){return super.getWorldDirection(J).negate()}updateMatrixWorld(J){super.updateMatrixWorld(J),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(J,Q){super.updateWorldMatrix(J,Q),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}var n8=new P,oZ=new _0,iZ=new _0;class TJ extends p7{constructor(J=50,Q=1,$=0.1,Z=2000){super();this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=J,this.zoom=1,this.near=$,this.far=Z,this.focus=10,this.aspect=Q,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(J,Q){return super.copy(J,Q),this.fov=J.fov,this.zoom=J.zoom,this.near=J.near,this.far=J.far,this.focus=J.focus,this.aspect=J.aspect,this.view=J.view===null?null:Object.assign({},J.view),this.filmGauge=J.filmGauge,this.filmOffset=J.filmOffset,this}setFocalLength(J){let Q=0.5*this.getFilmHeight()/J;this.fov=F9*2*Math.atan(Q),this.updateProjectionMatrix()}getFocalLength(){let J=Math.tan(V6*0.5*this.fov);return 0.5*this.getFilmHeight()/J}getEffectiveFOV(){return F9*2*Math.atan(Math.tan(V6*0.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(J,Q,$){n8.set(-1,-1,0.5).applyMatrix4(this.projectionMatrixInverse),Q.set(n8.x,n8.y).multiplyScalar(-J/n8.z),n8.set(1,1,0.5).applyMatrix4(this.projectionMatrixInverse),$.set(n8.x,n8.y).multiplyScalar(-J/n8.z)}getViewSize(J,Q){return this.getViewBounds(J,oZ,iZ),Q.subVectors(iZ,oZ)}setViewOffset(J,Q,$,Z,W,H){if(this.aspect=J/Q,this.view===null)this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1};this.view.enabled=!0,this.view.fullWidth=J,this.view.fullHeight=Q,this.view.offsetX=$,this.view.offsetY=Z,this.view.width=W,this.view.height=H,this.updateProjectionMatrix()}clearViewOffset(){if(this.view!==null)this.view.enabled=!1;this.updateProjectionMatrix()}updateProjectionMatrix(){let J=this.near,Q=J*Math.tan(V6*0.5*this.fov)/this.zoom,$=2*Q,Z=this.aspect*$,W=-0.5*Z,H=this.view;if(this.view!==null&&this.view.enabled){let{fullWidth:X,fullHeight:K}=H;W+=H.offsetX*Z/X,Q-=H.offsetY*$/K,Z*=H.width/X,$*=H.height/K}let Y=this.filmOffset;if(Y!==0)W+=J*Y/this.getFilmWidth();this.projectionMatrix.makePerspective(W,W+Z,Q,Q-$,J,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(J){let Q=super.toJSON(J);if(Q.object.fov=this.fov,Q.object.zoom=this.zoom,Q.object.near=this.near,Q.object.far=this.far,Q.object.focus=this.focus,Q.object.aspect=this.aspect,this.view!==null)Q.object.view=Object.assign({},this.view);return Q.object.filmGauge=this.filmGauge,Q.object.filmOffset=this.filmOffset,Q}}var d9=-90,m9=1;class c$ extends YJ{constructor(J,Q,$){super();this.type="CubeCamera",this.renderTarget=$,this.coordinateSystem=null,this.activeMipmapLevel=0;let Z=new TJ(d9,m9,J,Q);Z.layers=this.layers,this.add(Z);let W=new TJ(d9,m9,J,Q);W.layers=this.layers,this.add(W);let H=new TJ(d9,m9,J,Q);H.layers=this.layers,this.add(H);let Y=new TJ(d9,m9,J,Q);Y.layers=this.layers,this.add(Y);let X=new TJ(d9,m9,J,Q);X.layers=this.layers,this.add(X);let K=new TJ(d9,m9,J,Q);K.layers=this.layers,this.add(K)}updateCoordinateSystem(){let J=this.coordinateSystem,Q=this.children.concat(),[$,Z,W,H,Y,X]=Q;for(let K of Q)this.remove(K);if(J===2000)$.up.set(0,1,0),$.lookAt(1,0,0),Z.up.set(0,1,0),Z.lookAt(-1,0,0),W.up.set(0,0,-1),W.lookAt(0,1,0),H.up.set(0,0,1),H.lookAt(0,-1,0),Y.up.set(0,1,0),Y.lookAt(0,0,1),X.up.set(0,1,0),X.lookAt(0,0,-1);else if(J===2001)$.up.set(0,-1,0),$.lookAt(-1,0,0),Z.up.set(0,-1,0),Z.lookAt(1,0,0),W.up.set(0,0,1),W.lookAt(0,1,0),H.up.set(0,0,-1),H.lookAt(0,-1,0),Y.up.set(0,-1,0),Y.lookAt(0,0,1),X.up.set(0,-1,0),X.lookAt(0,0,-1);else throw Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+J);for(let K of Q)this.add(K),K.updateMatrixWorld()}update(J,Q){if(this.parent===null)this.updateMatrixWorld();let{renderTarget:$,activeMipmapLevel:Z}=this;if(this.coordinateSystem!==J.coordinateSystem)this.coordinateSystem=J.coordinateSystem,this.updateCoordinateSystem();let[W,H,Y,X,K,U]=this.children,G=J.getRenderTarget(),q=J.getActiveCubeFace(),E=J.getActiveMipmapLevel(),O=J.xr.enabled;J.xr.enabled=!1;let D=$.texture.generateMipmaps;$.texture.generateMipmaps=!1,J.setRenderTarget($,0,Z),J.render(Q,W),J.setRenderTarget($,1,Z),J.render(Q,H),J.setRenderTarget($,2,Z),J.render(Q,Y),J.setRenderTarget($,3,Z),J.render(Q,X),J.setRenderTarget($,4,Z),J.render(Q,K),$.texture.generateMipmaps=D,J.setRenderTarget($,5,Z),J.render(Q,U),J.setRenderTarget(G,q,E),J.xr.enabled=O,$.texture.needsPMREMUpdate=!0}}class l7 extends kJ{constructor(J=[],Q=301,$,Z,W,H,Y,X,K,U){super(J,Q,$,Z,W,H,Y,X,K,U);this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(J){this.image=J}}class n$ extends b8{constructor(J=1,Q={}){super(J,J,Q);this.isWebGLCubeRenderTarget=!0;let $={width:J,height:J,depth:1},Z=[$,$,$,$,$,$];this.texture=new l7(Z),this._setTextureOptions(Q),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(J,Q){this.texture.type=Q.type,this.texture.colorSpace=Q.colorSpace,this.texture.generateMipmaps=Q.generateMipmaps,this.texture.minFilter=Q.minFilter,this.texture.magFilter=Q.magFilter;let $={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},Z=new $6(5,5,5),W=new z8({name:"CubemapFromEquirect",uniforms:M9($.uniforms),vertexShader:$.vertexShader,fragmentShader:$.fragmentShader,side:1,blending:0});W.uniforms.tEquirect.value=Q;let H=new IJ(Z,W),Y=Q.minFilter;if(Q.minFilter===1008)Q.minFilter=1006;return new c$(1,10,this).update(J,H),Q.minFilter=Y,H.geometry.dispose(),H.material.dispose(),this}clear(J,Q=!0,$=!0,Z=!0){let W=J.getRenderTarget();for(let H=0;H<6;H++)J.setRenderTarget(this,H),J.clear(Q,$,Z);J.setRenderTarget(W)}}class D8 extends YJ{constructor(){super();this.isGroup=!0,this.type="Group"}}var SX={type:"move"};class j6{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){if(this._hand===null)this._hand=new D8,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1};return this._hand}getTargetRaySpace(){if(this._targetRay===null)this._targetRay=new D8,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new P,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new P;return this._targetRay}getGripSpace(){if(this._grip===null)this._grip=new D8,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new P,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new P;return this._grip}dispatchEvent(J){if(this._targetRay!==null)this._targetRay.dispatchEvent(J);if(this._grip!==null)this._grip.dispatchEvent(J);if(this._hand!==null)this._hand.dispatchEvent(J);return this}connect(J){if(J&&J.hand){let Q=this._hand;if(Q)for(let $ of J.hand.values())this._getHandJoint(Q,$)}return this.dispatchEvent({type:"connected",data:J}),this}disconnect(J){if(this.dispatchEvent({type:"disconnected",data:J}),this._targetRay!==null)this._targetRay.visible=!1;if(this._grip!==null)this._grip.visible=!1;if(this._hand!==null)this._hand.visible=!1;return this}update(J,Q,$){let Z=null,W=null,H=null,Y=this._targetRay,X=this._grip,K=this._hand;if(J&&Q.session.visibilityState!=="visible-blurred"){if(K&&J.hand){H=!0;for(let D of J.hand.values()){let k=Q.getJointPose(D,$),N=this._getHandJoint(K,D);if(k!==null)N.matrix.fromArray(k.transform.matrix),N.matrix.decompose(N.position,N.rotation,N.scale),N.matrixWorldNeedsUpdate=!0,N.jointRadius=k.radius;N.visible=k!==null}let U=K.joints["index-finger-tip"],G=K.joints["thumb-tip"],q=U.position.distanceTo(G.position),E=0.02,O=0.005;if(K.inputState.pinching&&q>E+O)K.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:J.handedness,target:this});else if(!K.inputState.pinching&&q<=E-O)K.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:J.handedness,target:this})}else if(X!==null&&J.gripSpace){if(W=Q.getPose(J.gripSpace,$),W!==null){if(X.matrix.fromArray(W.transform.matrix),X.matrix.decompose(X.position,X.rotation,X.scale),X.matrixWorldNeedsUpdate=!0,W.linearVelocity)X.hasLinearVelocity=!0,X.linearVelocity.copy(W.linearVelocity);else X.hasLinearVelocity=!1;if(W.angularVelocity)X.hasAngularVelocity=!0,X.angularVelocity.copy(W.angularVelocity);else X.hasAngularVelocity=!1}}if(Y!==null){if(Z=Q.getPose(J.targetRaySpace,$),Z===null&&W!==null)Z=W;if(Z!==null){if(Y.matrix.fromArray(Z.transform.matrix),Y.matrix.decompose(Y.position,Y.rotation,Y.scale),Y.matrixWorldNeedsUpdate=!0,Z.linearVelocity)Y.hasLinearVelocity=!0,Y.linearVelocity.copy(Z.linearVelocity);else Y.hasLinearVelocity=!1;if(Z.angularVelocity)Y.hasAngularVelocity=!0,Y.angularVelocity.copy(Z.angularVelocity);else Y.hasAngularVelocity=!1;this.dispatchEvent(SX)}}}if(Y!==null)Y.visible=Z!==null;if(X!==null)X.visible=W!==null;if(K!==null)K.visible=H!==null;return this}_getHandJoint(J,Q){if(J.joints[Q.jointName]===void 0){let $=new D8;$.matrixAutoUpdate=!1,$.visible=!1,J.joints[Q.jointName]=$,J.add($)}return J.joints[Q.jointName]}}class d7 extends YJ{constructor(){super();if(this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new q8,this.environmentIntensity=1,this.environmentRotation=new q8,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(J,Q){if(super.copy(J,Q),J.background!==null)this.background=J.background.clone();if(J.environment!==null)this.environment=J.environment.clone();if(J.fog!==null)this.fog=J.fog.clone();if(this.backgroundBlurriness=J.backgroundBlurriness,this.backgroundIntensity=J.backgroundIntensity,this.backgroundRotation.copy(J.backgroundRotation),this.environmentIntensity=J.environmentIntensity,this.environmentRotation.copy(J.environmentRotation),J.overrideMaterial!==null)this.overrideMaterial=J.overrideMaterial.clone();return this.matrixAutoUpdate=J.matrixAutoUpdate,this}toJSON(J){let Q=super.toJSON(J);if(this.fog!==null)Q.object.fog=this.fog.toJSON();if(this.backgroundBlurriness>0)Q.object.backgroundBlurriness=this.backgroundBlurriness;if(this.backgroundIntensity!==1)Q.object.backgroundIntensity=this.backgroundIntensity;if(Q.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1)Q.object.environmentIntensity=this.environmentIntensity;return Q.object.environmentRotation=this.environmentRotation.toArray(),Q}}class y6{constructor(J,Q){this.isInterleavedBuffer=!0,this.array=J,this.stride=Q,this.count=J!==void 0?J.length/Q:0,this.usage=35044,this.updateRanges=[],this.version=0,this.uuid=G8()}onUploadCallback(){}set needsUpdate(J){if(J===!0)this.version++}setUsage(J){return this.usage=J,this}addUpdateRange(J,Q){this.updateRanges.push({start:J,count:Q})}clearUpdateRanges(){this.updateRanges.length=0}copy(J){return this.array=new J.array.constructor(J.array),this.count=J.count,this.stride=J.stride,this.usage=J.usage,this}copyAt(J,Q,$){J*=this.stride,$*=Q.stride;for(let Z=0,W=this.stride;Z<W;Z++)this.array[J+Z]=Q.array[$+Z];return this}set(J,Q=0){return this.array.set(J,Q),this}clone(J){if(J.arrayBuffers===void 0)J.arrayBuffers={};if(this.array.buffer._uuid===void 0)this.array.buffer._uuid=G8();if(J.arrayBuffers[this.array.buffer._uuid]===void 0)J.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer;let Q=new this.array.constructor(J.arrayBuffers[this.array.buffer._uuid]),$=new this.constructor(Q,this.stride);return $.setUsage(this.usage),$}onUpload(J){return this.onUploadCallback=J,this}toJSON(J){if(J.arrayBuffers===void 0)J.arrayBuffers={};if(this.array.buffer._uuid===void 0)this.array.buffer._uuid=G8();if(J.arrayBuffers[this.array.buffer._uuid]===void 0)J.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer));return{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}var fJ=new P;class Z6{constructor(J,Q,$,Z=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=J,this.itemSize=Q,this.offset=$,this.normalized=Z}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(J){this.data.needsUpdate=J}applyMatrix4(J){for(let Q=0,$=this.data.count;Q<$;Q++)fJ.fromBufferAttribute(this,Q),fJ.applyMatrix4(J),this.setXYZ(Q,fJ.x,fJ.y,fJ.z);return this}applyNormalMatrix(J){for(let Q=0,$=this.count;Q<$;Q++)fJ.fromBufferAttribute(this,Q),fJ.applyNormalMatrix(J),this.setXYZ(Q,fJ.x,fJ.y,fJ.z);return this}transformDirection(J){for(let Q=0,$=this.count;Q<$;Q++)fJ.fromBufferAttribute(this,Q),fJ.transformDirection(J),this.setXYZ(Q,fJ.x,fJ.y,fJ.z);return this}getComponent(J,Q){let $=this.array[J*this.data.stride+this.offset+Q];if(this.normalized)$=U8($,this.array);return $}setComponent(J,Q,$){if(this.normalized)$=e0($,this.array);return this.data.array[J*this.data.stride+this.offset+Q]=$,this}setX(J,Q){if(this.normalized)Q=e0(Q,this.array);return this.data.array[J*this.data.stride+this.offset]=Q,this}setY(J,Q){if(this.normalized)Q=e0(Q,this.array);return this.data.array[J*this.data.stride+this.offset+1]=Q,this}setZ(J,Q){if(this.normalized)Q=e0(Q,this.array);return this.data.array[J*this.data.stride+this.offset+2]=Q,this}setW(J,Q){if(this.normalized)Q=e0(Q,this.array);return this.data.array[J*this.data.stride+this.offset+3]=Q,this}getX(J){let Q=this.data.array[J*this.data.stride+this.offset];if(this.normalized)Q=U8(Q,this.array);return Q}getY(J){let Q=this.data.array[J*this.data.stride+this.offset+1];if(this.normalized)Q=U8(Q,this.array);return Q}getZ(J){let Q=this.data.array[J*this.data.stride+this.offset+2];if(this.normalized)Q=U8(Q,this.array);return Q}getW(J){let Q=this.data.array[J*this.data.stride+this.offset+3];if(this.normalized)Q=U8(Q,this.array);return Q}setXY(J,Q,$){if(J=J*this.data.stride+this.offset,this.normalized)Q=e0(Q,this.array),$=e0($,this.array);return this.data.array[J+0]=Q,this.data.array[J+1]=$,this}setXYZ(J,Q,$,Z){if(J=J*this.data.stride+this.offset,this.normalized)Q=e0(Q,this.array),$=e0($,this.array),Z=e0(Z,this.array);return this.data.array[J+0]=Q,this.data.array[J+1]=$,this.data.array[J+2]=Z,this}setXYZW(J,Q,$,Z,W){if(J=J*this.data.stride+this.offset,this.normalized)Q=e0(Q,this.array),$=e0($,this.array),Z=e0(Z,this.array),W=e0(W,this.array);return this.data.array[J+0]=Q,this.data.array[J+1]=$,this.data.array[J+2]=Z,this.data.array[J+3]=W,this}clone(J){if(J===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");let Q=[];for(let $=0;$<this.count;$++){let Z=$*this.data.stride+this.offset;for(let W=0;W<this.itemSize;W++)Q.push(this.data.array[Z+W])}return new MJ(new this.array.constructor(Q),this.itemSize,this.normalized)}else{if(J.interleavedBuffers===void 0)J.interleavedBuffers={};if(J.interleavedBuffers[this.data.uuid]===void 0)J.interleavedBuffers[this.data.uuid]=this.data.clone(J);return new Z6(J.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}}toJSON(J){if(J===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");let Q=[];for(let $=0;$<this.count;$++){let Z=$*this.data.stride+this.offset;for(let W=0;W<this.itemSize;W++)Q.push(this.data.array[Z+W])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:Q,normalized:this.normalized}}else{if(J.interleavedBuffers===void 0)J.interleavedBuffers={};if(J.interleavedBuffers[this.data.uuid]===void 0)J.interleavedBuffers[this.data.uuid]=this.data.toJSON(J);return{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}}var aZ=new P,rZ=new a0,tZ=new a0,jX=new P,eZ=new j0,X7=new P,gQ=new nJ,JW=new j0,pQ=new F8;class m7 extends IJ{constructor(J,Q){super(J,Q);this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode="attached",this.bindMatrix=new j0,this.bindMatrixInverse=new j0,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){let J=this.geometry;if(this.boundingBox===null)this.boundingBox=new wJ;this.boundingBox.makeEmpty();let Q=J.getAttribute("position");for(let $=0;$<Q.count;$++)this.getVertexPosition($,X7),this.boundingBox.expandByPoint(X7)}computeBoundingSphere(){let J=this.geometry;if(this.boundingSphere===null)this.boundingSphere=new nJ;this.boundingSphere.makeEmpty();let Q=J.getAttribute("position");for(let $=0;$<Q.count;$++)this.getVertexPosition($,X7),this.boundingSphere.expandByPoint(X7)}copy(J,Q){if(super.copy(J,Q),this.bindMode=J.bindMode,this.bindMatrix.copy(J.bindMatrix),this.bindMatrixInverse.copy(J.bindMatrixInverse),this.skeleton=J.skeleton,J.boundingBox!==null)this.boundingBox=J.boundingBox.clone();if(J.boundingSphere!==null)this.boundingSphere=J.boundingSphere.clone();return this}raycast(J,Q){let $=this.material,Z=this.matrixWorld;if($===void 0)return;if(this.boundingSphere===null)this.computeBoundingSphere();if(gQ.copy(this.boundingSphere),gQ.applyMatrix4(Z),J.ray.intersectsSphere(gQ)===!1)return;if(JW.copy(Z).invert(),pQ.copy(J.ray).applyMatrix4(JW),this.boundingBox!==null){if(pQ.intersectsBox(this.boundingBox)===!1)return}this._computeIntersections(J,Q,pQ)}getVertexPosition(J,Q){return super.getVertexPosition(J,Q),this.applyBoneTransform(J,Q),Q}bind(J,Q){if(this.skeleton=J,Q===void 0)this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),Q=this.matrixWorld;this.bindMatrix.copy(Q),this.bindMatrixInverse.copy(Q).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){let J=new a0,Q=this.geometry.attributes.skinWeight;for(let $=0,Z=Q.count;$<Z;$++){J.fromBufferAttribute(Q,$);let W=1/J.manhattanLength();if(W!==1/0)J.multiplyScalar(W);else J.set(1,0,0,0);Q.setXYZW($,J.x,J.y,J.z,J.w)}}updateMatrixWorld(J){if(super.updateMatrixWorld(J),this.bindMode==="attached")this.bindMatrixInverse.copy(this.matrixWorld).invert();else if(this.bindMode==="detached")this.bindMatrixInverse.copy(this.bindMatrix).invert();else console.warn("THREE.SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(J,Q){let $=this.skeleton,Z=this.geometry;rZ.fromBufferAttribute(Z.attributes.skinIndex,J),tZ.fromBufferAttribute(Z.attributes.skinWeight,J),aZ.copy(Q).applyMatrix4(this.bindMatrix),Q.set(0,0,0);for(let W=0;W<4;W++){let H=tZ.getComponent(W);if(H!==0){let Y=rZ.getComponent(W);eZ.multiplyMatrices($.bones[Y].matrixWorld,$.boneInverses[Y]),Q.addScaledVector(jX.copy(aZ).applyMatrix4(eZ),H)}}return Q.applyMatrix4(this.bindMatrixInverse)}}class v6 extends YJ{constructor(){super();this.isBone=!0,this.type="Bone"}}class u7 extends kJ{constructor(J=null,Q=1,$=1,Z,W,H,Y,X,K=1003,U=1003,G,q){super(null,H,Y,X,K,U,Z,W,G,q);this.isDataTexture=!0,this.image={data:J,width:Q,height:$},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}var QW=new j0,yX=new j0;class f6{constructor(J=[],Q=[]){this.uuid=G8(),this.bones=J.slice(0),this.boneInverses=Q,this.boneMatrices=null,this.boneTexture=null,this.init()}init(){let J=this.bones,Q=this.boneInverses;if(this.boneMatrices=new Float32Array(J.length*16),Q.length===0)this.calculateInverses();else if(J.length!==Q.length){console.warn("THREE.Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let $=0,Z=this.bones.length;$<Z;$++)this.boneInverses.push(new j0)}}calculateInverses(){this.boneInverses.length=0;for(let J=0,Q=this.bones.length;J<Q;J++){let $=new j0;if(this.bones[J])$.copy(this.bones[J].matrixWorld).invert();this.boneInverses.push($)}}pose(){for(let J=0,Q=this.bones.length;J<Q;J++){let $=this.bones[J];if($)$.matrixWorld.copy(this.boneInverses[J]).invert()}for(let J=0,Q=this.bones.length;J<Q;J++){let $=this.bones[J];if($){if($.parent&&$.parent.isBone)$.matrix.copy($.parent.matrixWorld).invert(),$.matrix.multiply($.matrixWorld);else $.matrix.copy($.matrixWorld);$.matrix.decompose($.position,$.quaternion,$.scale)}}}update(){let J=this.bones,Q=this.boneInverses,$=this.boneMatrices,Z=this.boneTexture;for(let W=0,H=J.length;W<H;W++){let Y=J[W]?J[W].matrixWorld:yX;QW.multiplyMatrices(Y,Q[W]),QW.toArray($,W*16)}if(Z!==null)Z.needsUpdate=!0}clone(){return new f6(this.bones,this.boneInverses)}computeBoneTexture(){let J=Math.sqrt(this.bones.length*4);J=Math.ceil(J/4)*4,J=Math.max(J,4);let Q=new Float32Array(J*J*4);Q.set(this.boneMatrices);let $=new u7(Q,J,J,1023,1015);return $.needsUpdate=!0,this.boneMatrices=Q,this.boneTexture=$,this}getBoneByName(J){for(let Q=0,$=this.bones.length;Q<$;Q++){let Z=this.bones[Q];if(Z.name===J)return Z}return}dispose(){if(this.boneTexture!==null)this.boneTexture.dispose(),this.boneTexture=null}fromJSON(J,Q){this.uuid=J.uuid;for(let $=0,Z=J.bones.length;$<Z;$++){let W=J.bones[$],H=Q[W];if(H===void 0)console.warn("THREE.Skeleton: No bone found with UUID:",W),H=new v6;this.bones.push(H),this.boneInverses.push(new j0().fromArray(J.boneInverses[$]))}return this.init(),this}toJSON(){let J={metadata:{version:4.7,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};J.uuid=this.uuid;let Q=this.bones,$=this.boneInverses;for(let Z=0,W=Q.length;Z<W;Z++){let H=Q[Z];J.bones.push(H.uuid);let Y=$[Z];J.boneInverses.push(Y.toArray())}return J}}class O9 extends MJ{constructor(J,Q,$,Z=1){super(J,Q,$);this.isInstancedBufferAttribute=!0,this.meshPerAttribute=Z}copy(J){return super.copy(J),this.meshPerAttribute=J.meshPerAttribute,this}toJSON(){let J=super.toJSON();return J.meshPerAttribute=this.meshPerAttribute,J.isInstancedBufferAttribute=!0,J}}var u9=new j0,$W=new j0,K7=[],ZW=new wJ,vX=new j0,k6=new IJ,D6=new nJ;class c7 extends IJ{constructor(J,Q,$){super(J,Q);this.isInstancedMesh=!0,this.instanceMatrix=new O9(new Float32Array($*16),16),this.instanceColor=null,this.morphTexture=null,this.count=$,this.boundingBox=null,this.boundingSphere=null;for(let Z=0;Z<$;Z++)this.setMatrixAt(Z,vX)}computeBoundingBox(){let J=this.geometry,Q=this.count;if(this.boundingBox===null)this.boundingBox=new wJ;if(J.boundingBox===null)J.computeBoundingBox();this.boundingBox.makeEmpty();for(let $=0;$<Q;$++)this.getMatrixAt($,u9),ZW.copy(J.boundingBox).applyMatrix4(u9),this.boundingBox.union(ZW)}computeBoundingSphere(){let J=this.geometry,Q=this.count;if(this.boundingSphere===null)this.boundingSphere=new nJ;if(J.boundingSphere===null)J.computeBoundingSphere();this.boundingSphere.makeEmpty();for(let $=0;$<Q;$++)this.getMatrixAt($,u9),D6.copy(J.boundingSphere).applyMatrix4(u9),this.boundingSphere.union(D6)}copy(J,Q){if(super.copy(J,Q),this.instanceMatrix.copy(J.instanceMatrix),J.morphTexture!==null)this.morphTexture=J.morphTexture.clone();if(J.instanceColor!==null)this.instanceColor=J.instanceColor.clone();if(this.count=J.count,J.boundingBox!==null)this.boundingBox=J.boundingBox.clone();if(J.boundingSphere!==null)this.boundingSphere=J.boundingSphere.clone();return this}getColorAt(J,Q){Q.fromArray(this.instanceColor.array,J*3)}getMatrixAt(J,Q){Q.fromArray(this.instanceMatrix.array,J*16)}getMorphAt(J,Q){let $=Q.morphTargetInfluences,Z=this.morphTexture.source.data.data,W=$.length+1,H=J*W+1;for(let Y=0;Y<$.length;Y++)$[Y]=Z[H+Y]}raycast(J,Q){let $=this.matrixWorld,Z=this.count;if(k6.geometry=this.geometry,k6.material=this.material,k6.material===void 0)return;if(this.boundingSphere===null)this.computeBoundingSphere();if(D6.copy(this.boundingSphere),D6.applyMatrix4($),J.ray.intersectsSphere(D6)===!1)return;for(let W=0;W<Z;W++){this.getMatrixAt(W,u9),$W.multiplyMatrices($,u9),k6.matrixWorld=$W,k6.raycast(J,K7);for(let H=0,Y=K7.length;H<Y;H++){let X=K7[H];X.instanceId=W,X.object=this,Q.push(X)}K7.length=0}}setColorAt(J,Q){if(this.instanceColor===null)this.instanceColor=new O9(new Float32Array(this.instanceMatrix.count*3).fill(1),3);Q.toArray(this.instanceColor.array,J*3)}setMatrixAt(J,Q){Q.toArray(this.instanceMatrix.array,J*16)}setMorphAt(J,Q){let $=Q.morphTargetInfluences,Z=$.length+1;if(this.morphTexture===null)this.morphTexture=new u7(new Float32Array(Z*this.count),Z,this.count,1028,1015);let W=this.morphTexture.source.data.data,H=0;for(let K=0;K<$.length;K++)H+=$[K];let Y=this.geometry.morphTargetsRelative?1:1-H,X=Z*J;W[X]=Y,W.set($,X+1)}updateMorphTargets(){}dispose(){if(this.dispatchEvent({type:"dispose"}),this.morphTexture!==null)this.morphTexture.dispose(),this.morphTexture=null}}var lQ=new P,fX=new P,hX=new f0;class K8{constructor(J=new P(1,0,0),Q=0){this.isPlane=!0,this.normal=J,this.constant=Q}set(J,Q){return this.normal.copy(J),this.constant=Q,this}setComponents(J,Q,$,Z){return this.normal.set(J,Q,$),this.constant=Z,this}setFromNormalAndCoplanarPoint(J,Q){return this.normal.copy(J),this.constant=-Q.dot(this.normal),this}setFromCoplanarPoints(J,Q,$){let Z=lQ.subVectors($,Q).cross(fX.subVectors(J,Q)).normalize();return this.setFromNormalAndCoplanarPoint(Z,J),this}copy(J){return this.normal.copy(J.normal),this.constant=J.constant,this}normalize(){let J=1/this.normal.length();return this.normal.multiplyScalar(J),this.constant*=J,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(J){return this.normal.dot(J)+this.constant}distanceToSphere(J){return this.distanceToPoint(J.center)-J.radius}projectPoint(J,Q){return Q.copy(J).addScaledVector(this.normal,-this.distanceToPoint(J))}intersectLine(J,Q){let $=J.delta(lQ),Z=this.normal.dot($);if(Z===0){if(this.distanceToPoint(J.start)===0)return Q.copy(J.start);return null}let W=-(J.start.dot(this.normal)+this.constant)/Z;if(W<0||W>1)return null;return Q.copy(J.start).addScaledVector($,W)}intersectsLine(J){let Q=this.distanceToPoint(J.start),$=this.distanceToPoint(J.end);return Q<0&&$>0||$<0&&Q>0}intersectsBox(J){return J.intersectsPlane(this)}intersectsSphere(J){return J.intersectsPlane(this)}coplanarPoint(J){return J.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(J,Q){let $=Q||hX.getNormalMatrix(J),Z=this.coplanarPoint(lQ).applyMatrix4(J),W=this.normal.applyMatrix3($).normalize();return this.constant=-Z.dot(W),this}translate(J){return this.constant-=J.dot(this.normal),this}equals(J){return J.normal.equals(this.normal)&&J.constant===this.constant}clone(){return new this.constructor().copy(this)}}var N9=new nJ,xX=new _0(0.5,0.5),U7=new P;class h6{constructor(J=new K8,Q=new K8,$=new K8,Z=new K8,W=new K8,H=new K8){this.planes=[J,Q,$,Z,W,H]}set(J,Q,$,Z,W,H){let Y=this.planes;return Y[0].copy(J),Y[1].copy(Q),Y[2].copy($),Y[3].copy(Z),Y[4].copy(W),Y[5].copy(H),this}copy(J){let Q=this.planes;for(let $=0;$<6;$++)Q[$].copy(J.planes[$]);return this}setFromProjectionMatrix(J,Q=2000,$=!1){let Z=this.planes,W=J.elements,H=W[0],Y=W[1],X=W[2],K=W[3],U=W[4],G=W[5],q=W[6],E=W[7],O=W[8],D=W[9],k=W[10],N=W[11],F=W[12],C=W[13],L=W[14],_=W[15];if(Z[0].setComponents(K-H,E-U,N-O,_-F).normalize(),Z[1].setComponents(K+H,E+U,N+O,_+F).normalize(),Z[2].setComponents(K+Y,E+G,N+D,_+C).normalize(),Z[3].setComponents(K-Y,E-G,N-D,_-C).normalize(),$)Z[4].setComponents(X,q,k,L).normalize(),Z[5].setComponents(K-X,E-q,N-k,_-L).normalize();else if(Z[4].setComponents(K-X,E-q,N-k,_-L).normalize(),Q===2000)Z[5].setComponents(K+X,E+q,N+k,_+L).normalize();else if(Q===2001)Z[5].setComponents(X,q,k,L).normalize();else throw Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+Q);return this}intersectsObject(J){if(J.boundingSphere!==void 0){if(J.boundingSphere===null)J.computeBoundingSphere();N9.copy(J.boundingSphere).applyMatrix4(J.matrixWorld)}else{let Q=J.geometry;if(Q.boundingSphere===null)Q.computeBoundingSphere();N9.copy(Q.boundingSphere).applyMatrix4(J.matrixWorld)}return this.intersectsSphere(N9)}intersectsSprite(J){N9.center.set(0,0,0);let Q=xX.distanceTo(J.center);return N9.radius=0.7071067811865476+Q,N9.applyMatrix4(J.matrixWorld),this.intersectsSphere(N9)}intersectsSphere(J){let Q=this.planes,$=J.center,Z=-J.radius;for(let W=0;W<6;W++)if(Q[W].distanceToPoint($)<Z)return!1;return!0}intersectsBox(J){let Q=this.planes;for(let $=0;$<6;$++){let Z=Q[$];if(U7.x=Z.normal.x>0?J.max.x:J.min.x,U7.y=Z.normal.y>0?J.max.y:J.min.y,U7.z=Z.normal.z>0?J.max.z:J.min.z,Z.distanceToPoint(U7)<0)return!1}return!0}containsPoint(J){let Q=this.planes;for(let $=0;$<6;$++)if(Q[$].distanceToPoint(J)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class x6 extends sJ{constructor(J){super();this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new P0(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(J)}copy(J){return super.copy(J),this.color.copy(J.color),this.map=J.map,this.linewidth=J.linewidth,this.linecap=J.linecap,this.linejoin=J.linejoin,this.fog=J.fog,this}}var O7=new P,R7=new P,WW=new j0,M6=new F8,G7=new nJ,dQ=new P,HW=new P;class W6 extends YJ{constructor(J=new oJ,Q=new x6){super();this.isLine=!0,this.type="Line",this.geometry=J,this.material=Q,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(J,Q){return super.copy(J,Q),this.material=Array.isArray(J.material)?J.material.slice():J.material,this.geometry=J.geometry,this}computeLineDistances(){let J=this.geometry;if(J.index===null){let Q=J.attributes.position,$=[0];for(let Z=1,W=Q.count;Z<W;Z++)O7.fromBufferAttribute(Q,Z-1),R7.fromBufferAttribute(Q,Z),$[Z]=$[Z-1],$[Z]+=O7.distanceTo(R7);J.setAttribute("lineDistance",new Q8($,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(J,Q){let $=this.geometry,Z=this.matrixWorld,W=J.params.Line.threshold,H=$.drawRange;if($.boundingSphere===null)$.computeBoundingSphere();if(G7.copy($.boundingSphere),G7.applyMatrix4(Z),G7.radius+=W,J.ray.intersectsSphere(G7)===!1)return;WW.copy(Z).invert(),M6.copy(J.ray).applyMatrix4(WW);let Y=W/((this.scale.x+this.scale.y+this.scale.z)/3),X=Y*Y,K=this.isLineSegments?2:1,U=$.index,q=$.attributes.position;if(U!==null){let E=Math.max(0,H.start),O=Math.min(U.count,H.start+H.count);for(let D=E,k=O-1;D<k;D+=K){let N=U.getX(D),F=U.getX(D+1),C=q7(this,J,M6,X,N,F,D);if(C)Q.push(C)}if(this.isLineLoop){let D=U.getX(O-1),k=U.getX(E),N=q7(this,J,M6,X,D,k,O-1);if(N)Q.push(N)}}else{let E=Math.max(0,H.start),O=Math.min(q.count,H.start+H.count);for(let D=E,k=O-1;D<k;D+=K){let N=q7(this,J,M6,X,D,D+1,D);if(N)Q.push(N)}if(this.isLineLoop){let D=q7(this,J,M6,X,O-1,E,O-1);if(D)Q.push(D)}}}updateMorphTargets(){let Q=this.geometry.morphAttributes,$=Object.keys(Q);if($.length>0){let Z=Q[$[0]];if(Z!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let W=0,H=Z.length;W<H;W++){let Y=Z[W].name||String(W);this.morphTargetInfluences.push(0),this.morphTargetDictionary[Y]=W}}}}}function q7(J,Q,$,Z,W,H,Y){let X=J.geometry.attributes.position;if(O7.fromBufferAttribute(X,W),R7.fromBufferAttribute(X,H),$.distanceSqToSegment(O7,R7,dQ,HW)>Z)return;dQ.applyMatrix4(J.matrixWorld);let U=Q.ray.origin.distanceTo(dQ);if(U<Q.near||U>Q.far)return;return{distance:U,point:HW.clone().applyMatrix4(J.matrixWorld),index:Y,face:null,faceIndex:null,barycoord:null,object:J}}var YW=new P,XW=new P;class n7 extends W6{constructor(J,Q){super(J,Q);this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let J=this.geometry;if(J.index===null){let Q=J.attributes.position,$=[];for(let Z=0,W=Q.count;Z<W;Z+=2)YW.fromBufferAttribute(Q,Z),XW.fromBufferAttribute(Q,Z+1),$[Z]=Z===0?0:$[Z-1],$[Z+1]=$[Z]+YW.distanceTo(XW);J.setAttribute("lineDistance",new Q8($,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class s7 extends W6{constructor(J,Q){super(J,Q);this.isLineLoop=!0,this.type="LineLoop"}}class b6 extends sJ{constructor(J){super();this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new P0(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(J)}copy(J){return super.copy(J),this.color.copy(J.color),this.map=J.map,this.alphaMap=J.alphaMap,this.size=J.size,this.sizeAttenuation=J.sizeAttenuation,this.fog=J.fog,this}}var KW=new j0,nQ=new F8,E7=new nJ,N7=new P;class o7 extends YJ{constructor(J=new oJ,Q=new b6){super();this.isPoints=!0,this.type="Points",this.geometry=J,this.material=Q,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(J,Q){return super.copy(J,Q),this.material=Array.isArray(J.material)?J.material.slice():J.material,this.geometry=J.geometry,this}raycast(J,Q){let $=this.geometry,Z=this.matrixWorld,W=J.params.Points.threshold,H=$.drawRange;if($.boundingSphere===null)$.computeBoundingSphere();if(E7.copy($.boundingSphere),E7.applyMatrix4(Z),E7.radius+=W,J.ray.intersectsSphere(E7)===!1)return;KW.copy(Z).invert(),nQ.copy(J.ray).applyMatrix4(KW);let Y=W/((this.scale.x+this.scale.y+this.scale.z)/3),X=Y*Y,K=$.index,G=$.attributes.position;if(K!==null){let q=Math.max(0,H.start),E=Math.min(K.count,H.start+H.count);for(let O=q,D=E;O<D;O++){let k=K.getX(O);N7.fromBufferAttribute(G,k),UW(N7,k,X,Z,J,Q,this)}}else{let q=Math.max(0,H.start),E=Math.min(G.count,H.start+H.count);for(let O=q,D=E;O<D;O++)N7.fromBufferAttribute(G,O),UW(N7,O,X,Z,J,Q,this)}}updateMorphTargets(){let Q=this.geometry.morphAttributes,$=Object.keys(Q);if($.length>0){let Z=Q[$[0]];if(Z!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let W=0,H=Z.length;W<H;W++){let Y=Z[W].name||String(W);this.morphTargetInfluences.push(0),this.morphTargetDictionary[Y]=W}}}}}function UW(J,Q,$,Z,W,H,Y){let X=nQ.distanceSqToPoint(J);if(X<$){let K=new P;nQ.closestPointToPoint(J,K),K.applyMatrix4(Z);let U=W.ray.origin.distanceTo(K);if(U<W.near||U>W.far)return;H.push({distance:U,distanceToRay:Math.sqrt(X),point:K,index:Q,face:null,faceIndex:null,barycoord:null,object:Y})}}class i7 extends kJ{constructor(J,Q,$,Z,W,H,Y,X,K){super(J,Q,$,Z,W,H,Y,X,K);this.isCanvasTexture=!0,this.needsUpdate=!0}}class a7 extends kJ{constructor(J,Q,$=1014,Z,W,H,Y=1003,X=1003,K,U=1026,G=1){if(U!==1026&&U!==1027)throw Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let q={width:J,height:Q,depth:G};super(q,Z,W,H,Y,X,U,$,K);this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(J){return super.copy(J),this.source=new A6(Object.assign({},J.image)),this.compareFunction=J.compareFunction,this}toJSON(J){let Q=super.toJSON(J);if(this.compareFunction!==null)Q.compareFunction=this.compareFunction;return Q}}class r7 extends kJ{constructor(J=null){super();this.sourceTexture=J,this.isExternalTexture=!0}copy(J){return super.copy(J),this.sourceTexture=J.sourceTexture,this}}class L9 extends oJ{constructor(J=1,Q=1,$=1,Z=1){super();this.type="PlaneGeometry",this.parameters={width:J,height:Q,widthSegments:$,heightSegments:Z};let W=J/2,H=Q/2,Y=Math.floor($),X=Math.floor(Z),K=Y+1,U=X+1,G=J/Y,q=Q/X,E=[],O=[],D=[],k=[];for(let N=0;N<U;N++){let F=N*q-H;for(let C=0;C<K;C++){let L=C*G-W;O.push(L,-F,0),D.push(0,0,1),k.push(C/Y),k.push(1-N/X)}}for(let N=0;N<X;N++)for(let F=0;F<Y;F++){let C=F+K*N,L=F+K*(N+1),_=F+1+K*(N+1),j=F+1+K*N;E.push(C,L,j),E.push(L,_,j)}this.setIndex(E),this.setAttribute("position",new Q8(O,3)),this.setAttribute("normal",new Q8(D,3)),this.setAttribute("uv",new Q8(k,2))}copy(J){return super.copy(J),this.parameters=Object.assign({},J.parameters),this}static fromJSON(J){return new L9(J.width,J.height,J.widthSegments,J.heightSegments)}}class H6 extends sJ{constructor(J){super();this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new P0(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new P0(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new _0(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new q8,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(J)}copy(J){return super.copy(J),this.defines={STANDARD:""},this.color.copy(J.color),this.roughness=J.roughness,this.metalness=J.metalness,this.map=J.map,this.lightMap=J.lightMap,this.lightMapIntensity=J.lightMapIntensity,this.aoMap=J.aoMap,this.aoMapIntensity=J.aoMapIntensity,this.emissive.copy(J.emissive),this.emissiveMap=J.emissiveMap,this.emissiveIntensity=J.emissiveIntensity,this.bumpMap=J.bumpMap,this.bumpScale=J.bumpScale,this.normalMap=J.normalMap,this.normalMapType=J.normalMapType,this.normalScale.copy(J.normalScale),this.displacementMap=J.displacementMap,this.displacementScale=J.displacementScale,this.displacementBias=J.displacementBias,this.roughnessMap=J.roughnessMap,this.metalnessMap=J.metalnessMap,this.alphaMap=J.alphaMap,this.envMap=J.envMap,this.envMapRotation.copy(J.envMapRotation),this.envMapIntensity=J.envMapIntensity,this.wireframe=J.wireframe,this.wireframeLinewidth=J.wireframeLinewidth,this.wireframeLinecap=J.wireframeLinecap,this.wireframeLinejoin=J.wireframeLinejoin,this.flatShading=J.flatShading,this.fog=J.fog,this}}class iJ extends H6{constructor(J){super();this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new _0(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return d0(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(Q){this.ior=(1+0.4*Q)/(1-0.4*Q)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new P0(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new P0(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new P0(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(J)}get anisotropy(){return this._anisotropy}set anisotropy(J){if(this._anisotropy>0!==J>0)this.version++;this._anisotropy=J}get clearcoat(){return this._clearcoat}set clearcoat(J){if(this._clearcoat>0!==J>0)this.version++;this._clearcoat=J}get iridescence(){return this._iridescence}set iridescence(J){if(this._iridescence>0!==J>0)this.version++;this._iridescence=J}get dispersion(){return this._dispersion}set dispersion(J){if(this._dispersion>0!==J>0)this.version++;this._dispersion=J}get sheen(){return this._sheen}set sheen(J){if(this._sheen>0!==J>0)this.version++;this._sheen=J}get transmission(){return this._transmission}set transmission(J){if(this._transmission>0!==J>0)this.version++;this._transmission=J}copy(J){return super.copy(J),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=J.anisotropy,this.anisotropyRotation=J.anisotropyRotation,this.anisotropyMap=J.anisotropyMap,this.clearcoat=J.clearcoat,this.clearcoatMap=J.clearcoatMap,this.clearcoatRoughness=J.clearcoatRoughness,this.clearcoatRoughnessMap=J.clearcoatRoughnessMap,this.clearcoatNormalMap=J.clearcoatNormalMap,this.clearcoatNormalScale.copy(J.clearcoatNormalScale),this.dispersion=J.dispersion,this.ior=J.ior,this.iridescence=J.iridescence,this.iridescenceMap=J.iridescenceMap,this.iridescenceIOR=J.iridescenceIOR,this.iridescenceThicknessRange=[...J.iridescenceThicknessRange],this.iridescenceThicknessMap=J.iridescenceThicknessMap,this.sheen=J.sheen,this.sheenColor.copy(J.sheenColor),this.sheenColorMap=J.sheenColorMap,this.sheenRoughness=J.sheenRoughness,this.sheenRoughnessMap=J.sheenRoughnessMap,this.transmission=J.transmission,this.transmissionMap=J.transmissionMap,this.thickness=J.thickness,this.thicknessMap=J.thicknessMap,this.attenuationDistance=J.attenuationDistance,this.attenuationColor.copy(J.attenuationColor),this.specularIntensity=J.specularIntensity,this.specularIntensityMap=J.specularIntensityMap,this.specularColor.copy(J.specularColor),this.specularColorMap=J.specularColorMap,this}}class s$ extends sJ{constructor(J){super();this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=3200,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(J)}copy(J){return super.copy(J),this.depthPacking=J.depthPacking,this.map=J.map,this.alphaMap=J.alphaMap,this.displacementMap=J.displacementMap,this.displacementScale=J.displacementScale,this.displacementBias=J.displacementBias,this.wireframe=J.wireframe,this.wireframeLinewidth=J.wireframeLinewidth,this}}class o$ extends sJ{constructor(J){super();this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(J)}copy(J){return super.copy(J),this.map=J.map,this.alphaMap=J.alphaMap,this.displacementMap=J.displacementMap,this.displacementScale=J.displacementScale,this.displacementBias=J.displacementBias,this}}function F7(J,Q){if(!J||J.constructor===Q)return J;if(typeof Q.BYTES_PER_ELEMENT==="number")return new Q(J);return Array.prototype.slice.call(J)}function bX(J){return ArrayBuffer.isView(J)&&!(J instanceof DataView)}function gX(J){function Q(W,H){return J[W]-J[H]}let $=J.length,Z=Array($);for(let W=0;W!==$;++W)Z[W]=W;return Z.sort(Q),Z}function GW(J,Q,$){let Z=J.length,W=new J.constructor(Z);for(let H=0,Y=0;Y!==Z;++H){let X=$[H]*Q;for(let K=0;K!==Q;++K)W[Y++]=J[X+K]}return W}function RH(J,Q,$,Z){let W=1,H=J[0];while(H!==void 0&&H[Z]===void 0)H=J[W++];if(H===void 0)return;let Y=H[Z];if(Y===void 0)return;if(Array.isArray(Y))do{if(Y=H[Z],Y!==void 0)Q.push(H.time),$.push(...Y);H=J[W++]}while(H!==void 0);else if(Y.toArray!==void 0)do{if(Y=H[Z],Y!==void 0)Q.push(H.time),Y.toArray($,$.length);H=J[W++]}while(H!==void 0);else do{if(Y=H[Z],Y!==void 0)Q.push(H.time),$.push(Y);H=J[W++]}while(H!==void 0)}class e8{constructor(J,Q,$,Z){this.parameterPositions=J,this._cachedIndex=0,this.resultBuffer=Z!==void 0?Z:new Q.constructor($),this.sampleValues=Q,this.valueSize=$,this.settings=null,this.DefaultSettings_={}}evaluate(J){let Q=this.parameterPositions,$=this._cachedIndex,Z=Q[$],W=Q[$-1];$:{J:{let H;Q:{Z:if(!(J<Z)){for(let Y=$+2;;){if(Z===void 0){if(J<W)break Z;return $=Q.length,this._cachedIndex=$,this.copySampleValue_($-1)}if($===Y)break;if(W=Z,Z=Q[++$],J<Z)break J}H=Q.length;break Q}if(!(J>=W)){let Y=Q[1];if(J<Y)$=2,W=Y;for(let X=$-2;;){if(W===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if($===X)break;if(Z=W,W=Q[--$-1],J>=W)break J}H=$,$=0;break Q}break $}while($<H){let Y=$+H>>>1;if(J<Q[Y])H=Y;else $=Y+1}if(Z=Q[$],W=Q[$-1],W===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(Z===void 0)return $=Q.length,this._cachedIndex=$,this.copySampleValue_($-1)}this._cachedIndex=$,this.intervalChanged_($,W,Z)}return this.interpolate_($,W,J,Z)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(J){let Q=this.resultBuffer,$=this.sampleValues,Z=this.valueSize,W=J*Z;for(let H=0;H!==Z;++H)Q[H]=$[W+H];return Q}interpolate_(){throw Error("call to abstract method")}intervalChanged_(){}}class i$ extends e8{constructor(J,Q,$,Z){super(J,Q,$,Z);this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:2400,endingEnd:2400}}intervalChanged_(J,Q,$){let Z=this.parameterPositions,W=J-2,H=J+1,Y=Z[W],X=Z[H];if(Y===void 0)switch(this.getSettings_().endingStart){case 2401:W=J,Y=2*Q-$;break;case 2402:W=Z.length-2,Y=Q+Z[W]-Z[W+1];break;default:W=J,Y=$}if(X===void 0)switch(this.getSettings_().endingEnd){case 2401:H=J,X=2*$-Q;break;case 2402:H=1,X=$+Z[1]-Z[0];break;default:H=J-1,X=Q}let K=($-Q)*0.5,U=this.valueSize;this._weightPrev=K/(Q-Y),this._weightNext=K/(X-$),this._offsetPrev=W*U,this._offsetNext=H*U}interpolate_(J,Q,$,Z){let W=this.resultBuffer,H=this.sampleValues,Y=this.valueSize,X=J*Y,K=X-Y,U=this._offsetPrev,G=this._offsetNext,q=this._weightPrev,E=this._weightNext,O=($-Q)/(Z-Q),D=O*O,k=D*O,N=-q*k+2*q*D-q*O,F=(1+q)*k+(-1.5-2*q)*D+(-0.5+q)*O+1,C=(-1-E)*k+(1.5+E)*D+0.5*O,L=E*k-E*D;for(let _=0;_!==Y;++_)W[_]=N*H[U+_]+F*H[K+_]+C*H[X+_]+L*H[G+_];return W}}class a$ extends e8{constructor(J,Q,$,Z){super(J,Q,$,Z)}interpolate_(J,Q,$,Z){let W=this.resultBuffer,H=this.sampleValues,Y=this.valueSize,X=J*Y,K=X-Y,U=($-Q)/(Z-Q),G=1-U;for(let q=0;q!==Y;++q)W[q]=H[K+q]*G+H[X+q]*U;return W}}class r$ extends e8{constructor(J,Q,$,Z){super(J,Q,$,Z)}interpolate_(J){return this.copySampleValue_(J-1)}}class aJ{constructor(J,Q,$,Z){if(J===void 0)throw Error("THREE.KeyframeTrack: track name is undefined");if(Q===void 0||Q.length===0)throw Error("THREE.KeyframeTrack: no keyframes in track named "+J);this.name=J,this.times=F7(Q,this.TimeBufferType),this.values=F7($,this.ValueBufferType),this.setInterpolation(Z||this.DefaultInterpolation)}static toJSON(J){let Q=J.constructor,$;if(Q.toJSON!==this.toJSON)$=Q.toJSON(J);else{$={name:J.name,times:F7(J.times,Array),values:F7(J.values,Array)};let Z=J.getInterpolation();if(Z!==J.DefaultInterpolation)$.interpolation=Z}return $.type=J.ValueTypeName,$}InterpolantFactoryMethodDiscrete(J){return new r$(this.times,this.values,this.getValueSize(),J)}InterpolantFactoryMethodLinear(J){return new a$(this.times,this.values,this.getValueSize(),J)}InterpolantFactoryMethodSmooth(J){return new i$(this.times,this.values,this.getValueSize(),J)}setInterpolation(J){let Q;switch(J){case 2300:Q=this.InterpolantFactoryMethodDiscrete;break;case 2301:Q=this.InterpolantFactoryMethodLinear;break;case 2302:Q=this.InterpolantFactoryMethodSmooth;break}if(Q===void 0){let $="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(J!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw Error($);return console.warn("THREE.KeyframeTrack:",$),this}return this.createInterpolant=Q,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return 2300;case this.InterpolantFactoryMethodLinear:return 2301;case this.InterpolantFactoryMethodSmooth:return 2302}}getValueSize(){return this.values.length/this.times.length}shift(J){if(J!==0){let Q=this.times;for(let $=0,Z=Q.length;$!==Z;++$)Q[$]+=J}return this}scale(J){if(J!==1){let Q=this.times;for(let $=0,Z=Q.length;$!==Z;++$)Q[$]*=J}return this}trim(J,Q){let $=this.times,Z=$.length,W=0,H=Z-1;while(W!==Z&&$[W]<J)++W;while(H!==-1&&$[H]>Q)--H;if(++H,W!==0||H!==Z){if(W>=H)H=Math.max(H,1),W=H-1;let Y=this.getValueSize();this.times=$.slice(W,H),this.values=this.values.slice(W*Y,H*Y)}return this}validate(){let J=!0,Q=this.getValueSize();if(Q-Math.floor(Q)!==0)console.error("THREE.KeyframeTrack: Invalid value size in track.",this),J=!1;let $=this.times,Z=this.values,W=$.length;if(W===0)console.error("THREE.KeyframeTrack: Track is empty.",this),J=!1;let H=null;for(let Y=0;Y!==W;Y++){let X=$[Y];if(typeof X==="number"&&isNaN(X)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,Y,X),J=!1;break}if(H!==null&&H>X){console.error("THREE.KeyframeTrack: Out of order keys.",this,Y,X,H),J=!1;break}H=X}if(Z!==void 0){if(bX(Z))for(let Y=0,X=Z.length;Y!==X;++Y){let K=Z[Y];if(isNaN(K)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,Y,K),J=!1;break}}}return J}optimize(){let J=this.times.slice(),Q=this.values.slice(),$=this.getValueSize(),Z=this.getInterpolation()===2302,W=J.length-1,H=1;for(let Y=1;Y<W;++Y){let X=!1,K=J[Y],U=J[Y+1];if(K!==U&&(Y!==1||K!==J[0]))if(!Z){let G=Y*$,q=G-$,E=G+$;for(let O=0;O!==$;++O){let D=Q[G+O];if(D!==Q[q+O]||D!==Q[E+O]){X=!0;break}}}else X=!0;if(X){if(Y!==H){J[H]=J[Y];let G=Y*$,q=H*$;for(let E=0;E!==$;++E)Q[q+E]=Q[G+E]}++H}}if(W>0){J[H]=J[W];for(let Y=W*$,X=H*$,K=0;K!==$;++K)Q[X+K]=Q[Y+K];++H}if(H!==J.length)this.times=J.slice(0,H),this.values=Q.slice(0,H*$);else this.times=J,this.values=Q;return this}clone(){let J=this.times.slice(),Q=this.values.slice(),Z=new this.constructor(this.name,J,Q);return Z.createInterpolant=this.createInterpolant,Z}}aJ.prototype.ValueTypeName="";aJ.prototype.TimeBufferType=Float32Array;aJ.prototype.ValueBufferType=Float32Array;aJ.prototype.DefaultInterpolation=2301;class J9 extends aJ{constructor(J,Q,$){super(J,Q,$)}}J9.prototype.ValueTypeName="bool";J9.prototype.ValueBufferType=Array;J9.prototype.DefaultInterpolation=2300;J9.prototype.InterpolantFactoryMethodLinear=void 0;J9.prototype.InterpolantFactoryMethodSmooth=void 0;class t7 extends aJ{constructor(J,Q,$,Z){super(J,Q,$,Z)}}t7.prototype.ValueTypeName="color";class j8 extends aJ{constructor(J,Q,$,Z){super(J,Q,$,Z)}}j8.prototype.ValueTypeName="number";class t$ extends e8{constructor(J,Q,$,Z){super(J,Q,$,Z)}interpolate_(J,Q,$,Z){let W=this.resultBuffer,H=this.sampleValues,Y=this.valueSize,X=($-Q)/(Z-Q),K=J*Y;for(let U=K+Y;K!==U;K+=4)jJ.slerpFlat(W,0,H,K-Y,H,K,X);return W}}class g8 extends aJ{constructor(J,Q,$,Z){super(J,Q,$,Z)}InterpolantFactoryMethodLinear(J){return new t$(this.times,this.values,this.getValueSize(),J)}}g8.prototype.ValueTypeName="quaternion";g8.prototype.InterpolantFactoryMethodSmooth=void 0;class Q9 extends aJ{constructor(J,Q,$){super(J,Q,$)}}Q9.prototype.ValueTypeName="string";Q9.prototype.ValueBufferType=Array;Q9.prototype.DefaultInterpolation=2300;Q9.prototype.InterpolantFactoryMethodLinear=void 0;Q9.prototype.InterpolantFactoryMethodSmooth=void 0;class y8 extends aJ{constructor(J,Q,$,Z){super(J,Q,$,Z)}}y8.prototype.ValueTypeName="vector";class e7{constructor(J="",Q=-1,$=[],Z=2500){if(this.name=J,this.tracks=$,this.duration=Q,this.blendMode=Z,this.uuid=G8(),this.userData={},this.duration<0)this.resetDuration()}static parse(J){let Q=[],$=J.tracks,Z=1/(J.fps||1);for(let H=0,Y=$.length;H!==Y;++H)Q.push(lX($[H]).scale(Z));let W=new this(J.name,J.duration,Q,J.blendMode);return W.uuid=J.uuid,W.userData=JSON.parse(J.userData||"{}"),W}static toJSON(J){let Q=[],$=J.tracks,Z={name:J.name,duration:J.duration,tracks:Q,uuid:J.uuid,blendMode:J.blendMode,userData:JSON.stringify(J.userData)};for(let W=0,H=$.length;W!==H;++W)Q.push(aJ.toJSON($[W]));return Z}static CreateFromMorphTargetSequence(J,Q,$,Z){let W=Q.length,H=[];for(let Y=0;Y<W;Y++){let X=[],K=[];X.push((Y+W-1)%W,Y,(Y+1)%W),K.push(0,1,0);let U=gX(X);if(X=GW(X,1,U),K=GW(K,1,U),!Z&&X[0]===0)X.push(W),K.push(K[0]);H.push(new j8(".morphTargetInfluences["+Q[Y].name+"]",X,K).scale(1/$))}return new this(J,-1,H)}static findByName(J,Q){let $=J;if(!Array.isArray(J)){let Z=J;$=Z.geometry&&Z.geometry.animations||Z.animations}for(let Z=0;Z<$.length;Z++)if($[Z].name===Q)return $[Z];return null}static CreateClipsFromMorphTargetSequences(J,Q,$){let Z={},W=/^([\w-]*?)([\d]+)$/;for(let Y=0,X=J.length;Y<X;Y++){let K=J[Y],U=K.name.match(W);if(U&&U.length>1){let G=U[1],q=Z[G];if(!q)Z[G]=q=[];q.push(K)}}let H=[];for(let Y in Z)H.push(this.CreateFromMorphTargetSequence(Y,Z[Y],Q,$));return H}static parseAnimation(J,Q){if(console.warn("THREE.AnimationClip: parseAnimation() is deprecated and will be removed with r185"),!J)return console.error("THREE.AnimationClip: No animation in JSONLoader data."),null;let $=function(G,q,E,O,D){if(E.length!==0){let k=[],N=[];if(RH(E,k,N,O),k.length!==0)D.push(new G(q,k,N))}},Z=[],W=J.name||"default",H=J.fps||30,Y=J.blendMode,X=J.length||-1,K=J.hierarchy||[];for(let G=0;G<K.length;G++){let q=K[G].keys;if(!q||q.length===0)continue;if(q[0].morphTargets){let E={},O;for(O=0;O<q.length;O++)if(q[O].morphTargets)for(let D=0;D<q[O].morphTargets.length;D++)E[q[O].morphTargets[D]]=-1;for(let D in E){let k=[],N=[];for(let F=0;F!==q[O].morphTargets.length;++F){let C=q[O];k.push(C.time),N.push(C.morphTarget===D?1:0)}Z.push(new j8(".morphTargetInfluence["+D+"]",k,N))}X=E.length*H}else{let E=".bones["+Q[G].name+"]";$(y8,E+".position",q,"pos",Z),$(g8,E+".quaternion",q,"rot",Z),$(y8,E+".scale",q,"scl",Z)}}if(Z.length===0)return null;return new this(W,X,Z,Y)}resetDuration(){let J=this.tracks,Q=0;for(let $=0,Z=J.length;$!==Z;++$){let W=this.tracks[$];Q=Math.max(Q,W.times[W.times.length-1])}return this.duration=Q,this}trim(){for(let J=0;J<this.tracks.length;J++)this.tracks[J].trim(0,this.duration);return this}validate(){let J=!0;for(let Q=0;Q<this.tracks.length;Q++)J=J&&this.tracks[Q].validate();return J}optimize(){for(let J=0;J<this.tracks.length;J++)this.tracks[J].optimize();return this}clone(){let J=[];for(let $=0;$<this.tracks.length;$++)J.push(this.tracks[$].clone());let Q=new this.constructor(this.name,this.duration,J,this.blendMode);return Q.userData=JSON.parse(JSON.stringify(this.userData)),Q}toJSON(){return this.constructor.toJSON(this)}}function pX(J){switch(J.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return j8;case"vector":case"vector2":case"vector3":case"vector4":return y8;case"color":return t7;case"quaternion":return g8;case"bool":case"boolean":return J9;case"string":return Q9}throw Error("THREE.KeyframeTrack: Unsupported typeName: "+J)}function lX(J){if(J.type===void 0)throw Error("THREE.KeyframeTrack: track type undefined, can not parse");let Q=pX(J.type);if(J.times===void 0){let $=[],Z=[];RH(J.keys,$,Z,"value"),J.times=$,J.values=Z}if(Q.parse!==void 0)return Q.parse(J);else return new Q(J.name,J.times,J.values,J.interpolation)}var M8={enabled:!1,files:{},add:function(J,Q){if(this.enabled===!1)return;this.files[J]=Q},get:function(J){if(this.enabled===!1)return;return this.files[J]},remove:function(J){delete this.files[J]},clear:function(){this.files={}}};class e${constructor(J,Q,$){let Z=this,W=!1,H=0,Y=0,X=void 0,K=[];this.onStart=void 0,this.onLoad=J,this.onProgress=Q,this.onError=$,this.abortController=new AbortController,this.itemStart=function(U){if(Y++,W===!1){if(Z.onStart!==void 0)Z.onStart(U,H,Y)}W=!0},this.itemEnd=function(U){if(H++,Z.onProgress!==void 0)Z.onProgress(U,H,Y);if(H===Y){if(W=!1,Z.onLoad!==void 0)Z.onLoad()}},this.itemError=function(U){if(Z.onError!==void 0)Z.onError(U)},this.resolveURL=function(U){if(X)return X(U);return U},this.setURLModifier=function(U){return X=U,this},this.addHandler=function(U,G){return K.push(U,G),this},this.removeHandler=function(U){let G=K.indexOf(U);if(G!==-1)K.splice(G,2);return this},this.getHandler=function(U){for(let G=0,q=K.length;G<q;G+=2){let E=K[G],O=K[G+1];if(E.global)E.lastIndex=0;if(E.test(U))return O}return null},this.abort=function(){return this.abortController.abort(),this.abortController=new AbortController,this}}}var kH=new e$;class p8{constructor(J){this.manager=J!==void 0?J:kH,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(J,Q){let $=this;return new Promise(function(Z,W){$.load(J,Z,Q,W)})}parse(){}setCrossOrigin(J){return this.crossOrigin=J,this}setWithCredentials(J){return this.withCredentials=J,this}setPath(J){return this.path=J,this}setResourcePath(J){return this.resourcePath=J,this}setRequestHeader(J){return this.requestHeader=J,this}abort(){return this}}p8.DEFAULT_MATERIAL_NAME="__DEFAULT";var A8={};class DH extends Error{constructor(J,Q){super(J);this.response=Q}}class g6 extends p8{constructor(J){super(J);this.mimeType="",this.responseType="",this._abortController=new AbortController}load(J,Q,$,Z){if(J===void 0)J="";if(this.path!==void 0)J=this.path+J;J=this.manager.resolveURL(J);let W=M8.get(`file:${J}`);if(W!==void 0)return this.manager.itemStart(J),setTimeout(()=>{if(Q)Q(W);this.manager.itemEnd(J)},0),W;if(A8[J]!==void 0){A8[J].push({onLoad:Q,onProgress:$,onError:Z});return}A8[J]=[],A8[J].push({onLoad:Q,onProgress:$,onError:Z});let H=new Request(J,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin",signal:typeof AbortSignal.any==="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal}),Y=this.mimeType,X=this.responseType;fetch(H).then((K)=>{if(K.status===200||K.status===0){if(K.status===0)console.warn("THREE.FileLoader: HTTP Status 0 received.");if(typeof ReadableStream>"u"||K.body===void 0||K.body.getReader===void 0)return K;let U=A8[J],G=K.body.getReader(),q=K.headers.get("X-File-Size")||K.headers.get("Content-Length"),E=q?parseInt(q):0,O=E!==0,D=0,k=new ReadableStream({start(N){F();function F(){G.read().then(({done:C,value:L})=>{if(C)N.close();else{D+=L.byteLength;let _=new ProgressEvent("progress",{lengthComputable:O,loaded:D,total:E});for(let j=0,w=U.length;j<w;j++){let S=U[j];if(S.onProgress)S.onProgress(_)}N.enqueue(L),F()}},(C)=>{N.error(C)})}}});return new Response(k)}else throw new DH(`fetch for "${K.url}" responded with ${K.status}: ${K.statusText}`,K)}).then((K)=>{switch(X){case"arraybuffer":return K.arrayBuffer();case"blob":return K.blob();case"document":return K.text().then((U)=>{return new DOMParser().parseFromString(U,Y)});case"json":return K.json();default:if(Y==="")return K.text();else{let G=/charset="?([^;"\s]*)"?/i.exec(Y),q=G&&G[1]?G[1].toLowerCase():void 0,E=new TextDecoder(q);return K.arrayBuffer().then((O)=>E.decode(O))}}}).then((K)=>{M8.add(`file:${J}`,K);let U=A8[J];delete A8[J];for(let G=0,q=U.length;G<q;G++){let E=U[G];if(E.onLoad)E.onLoad(K)}}).catch((K)=>{let U=A8[J];if(U===void 0)throw this.manager.itemError(J),K;delete A8[J];for(let G=0,q=U.length;G<q;G++){let E=U[G];if(E.onError)E.onError(K)}this.manager.itemError(J)}).finally(()=>{this.manager.itemEnd(J)}),this.manager.itemStart(J)}setResponseType(J){return this.responseType=J,this}setMimeType(J){return this.mimeType=J,this}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}}var c9=new WeakMap;class JZ extends p8{constructor(J){super(J)}load(J,Q,$,Z){if(this.path!==void 0)J=this.path+J;J=this.manager.resolveURL(J);let W=this,H=M8.get(`image:${J}`);if(H!==void 0){if(H.complete===!0)W.manager.itemStart(J),setTimeout(function(){if(Q)Q(H);W.manager.itemEnd(J)},0);else{let G=c9.get(H);if(G===void 0)G=[],c9.set(H,G);G.push({onLoad:Q,onError:Z})}return H}let Y=s9("img");function X(){if(U(),Q)Q(this);let G=c9.get(this)||[];for(let q=0;q<G.length;q++){let E=G[q];if(E.onLoad)E.onLoad(this)}c9.delete(this),W.manager.itemEnd(J)}function K(G){if(U(),Z)Z(G);M8.remove(`image:${J}`);let q=c9.get(this)||[];for(let E=0;E<q.length;E++){let O=q[E];if(O.onError)O.onError(G)}c9.delete(this),W.manager.itemError(J),W.manager.itemEnd(J)}function U(){Y.removeEventListener("load",X,!1),Y.removeEventListener("error",K,!1)}if(Y.addEventListener("load",X,!1),Y.addEventListener("error",K,!1),J.slice(0,5)!=="data:"){if(this.crossOrigin!==void 0)Y.crossOrigin=this.crossOrigin}return M8.add(`image:${J}`,Y),W.manager.itemStart(J),Y.src=J,Y}}class JQ extends p8{constructor(J){super(J)}load(J,Q,$,Z){let W=new kJ,H=new JZ(this.manager);return H.setCrossOrigin(this.crossOrigin),H.setPath(this.path),H.load(J,function(Y){if(W.image=Y,W.needsUpdate=!0,Q!==void 0)Q(W)},$,Z),W}}class Y6 extends YJ{constructor(J,Q=1){super();this.isLight=!0,this.type="Light",this.color=new P0(J),this.intensity=Q}dispose(){}copy(J,Q){return super.copy(J,Q),this.color.copy(J.color),this.intensity=J.intensity,this}toJSON(J){let Q=super.toJSON(J);if(Q.object.color=this.color.getHex(),Q.object.intensity=this.intensity,this.groundColor!==void 0)Q.object.groundColor=this.groundColor.getHex();if(this.distance!==void 0)Q.object.distance=this.distance;if(this.angle!==void 0)Q.object.angle=this.angle;if(this.decay!==void 0)Q.object.decay=this.decay;if(this.penumbra!==void 0)Q.object.penumbra=this.penumbra;if(this.shadow!==void 0)Q.object.shadow=this.shadow.toJSON();if(this.target!==void 0)Q.object.target=this.target.uuid;return Q}}class QQ extends Y6{constructor(J,Q,$){super(J,$);this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(YJ.DEFAULT_UP),this.updateMatrix(),this.groundColor=new P0(Q)}copy(J,Q){return super.copy(J,Q),this.groundColor.copy(J.groundColor),this}}var mQ=new j0,qW=new P,EW=new P;class $Q{constructor(J){this.camera=J,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new _0(512,512),this.mapType=1009,this.map=null,this.mapPass=null,this.matrix=new j0,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new h6,this._frameExtents=new _0(1,1),this._viewportCount=1,this._viewports=[new a0(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(J){let Q=this.camera,$=this.matrix;if(qW.setFromMatrixPosition(J.matrixWorld),Q.position.copy(qW),EW.setFromMatrixPosition(J.target.matrixWorld),Q.lookAt(EW),Q.updateMatrixWorld(),mQ.multiplyMatrices(Q.projectionMatrix,Q.matrixWorldInverse),this._frustum.setFromProjectionMatrix(mQ,Q.coordinateSystem,Q.reversedDepth),Q.reversedDepth)$.set(0.5,0,0,0.5,0,0.5,0,0.5,0,0,1,0,0,0,0,1);else $.set(0.5,0,0,0.5,0,0.5,0,0.5,0,0,0.5,0.5,0,0,0,1);$.multiply(mQ)}getViewport(J){return this._viewports[J]}getFrameExtents(){return this._frameExtents}dispose(){if(this.map)this.map.dispose();if(this.mapPass)this.mapPass.dispose()}copy(J){return this.camera=J.camera.clone(),this.intensity=J.intensity,this.bias=J.bias,this.radius=J.radius,this.autoUpdate=J.autoUpdate,this.needsUpdate=J.needsUpdate,this.normalBias=J.normalBias,this.blurSamples=J.blurSamples,this.mapSize.copy(J.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){let J={};if(this.intensity!==1)J.intensity=this.intensity;if(this.bias!==0)J.bias=this.bias;if(this.normalBias!==0)J.normalBias=this.normalBias;if(this.radius!==1)J.radius=this.radius;if(this.mapSize.x!==512||this.mapSize.y!==512)J.mapSize=this.mapSize.toArray();return J.camera=this.camera.toJSON(!1).object,delete J.camera.matrix,J}}class MH extends $Q{constructor(){super(new TJ(50,1,0.5,500));this.isSpotLightShadow=!0,this.focus=1,this.aspect=1}updateMatrices(J){let Q=this.camera,$=F9*2*J.angle*this.focus,Z=this.mapSize.width/this.mapSize.height*this.aspect,W=J.distance||Q.far;if($!==Q.fov||Z!==Q.aspect||W!==Q.far)Q.fov=$,Q.aspect=Z,Q.far=W,Q.updateProjectionMatrix();super.updateMatrices(J)}copy(J){return super.copy(J),this.focus=J.focus,this}}class ZQ extends Y6{constructor(J,Q,$=0,Z=Math.PI/3,W=0,H=2){super(J,Q);this.isSpotLight=!0,this.type="SpotLight",this.position.copy(YJ.DEFAULT_UP),this.updateMatrix(),this.target=new YJ,this.distance=$,this.angle=Z,this.penumbra=W,this.decay=H,this.map=null,this.shadow=new MH}get power(){return this.intensity*Math.PI}set power(J){this.intensity=J/Math.PI}dispose(){this.shadow.dispose()}copy(J,Q){return super.copy(J,Q),this.distance=J.distance,this.angle=J.angle,this.penumbra=J.penumbra,this.decay=J.decay,this.target=J.target.clone(),this.shadow=J.shadow.clone(),this}}var NW=new j0,L6=new P,uQ=new P;class LH extends $Q{constructor(){super(new TJ(90,1,0.5,500));this.isPointLightShadow=!0,this._frameExtents=new _0(4,2),this._viewportCount=6,this._viewports=[new a0(2,1,1,1),new a0(0,1,1,1),new a0(3,1,1,1),new a0(1,1,1,1),new a0(3,0,1,1),new a0(1,0,1,1)],this._cubeDirections=[new P(1,0,0),new P(-1,0,0),new P(0,0,1),new P(0,0,-1),new P(0,1,0),new P(0,-1,0)],this._cubeUps=[new P(0,1,0),new P(0,1,0),new P(0,1,0),new P(0,1,0),new P(0,0,1),new P(0,0,-1)]}updateMatrices(J,Q=0){let $=this.camera,Z=this.matrix,W=J.distance||$.far;if(W!==$.far)$.far=W,$.updateProjectionMatrix();L6.setFromMatrixPosition(J.matrixWorld),$.position.copy(L6),uQ.copy($.position),uQ.add(this._cubeDirections[Q]),$.up.copy(this._cubeUps[Q]),$.lookAt(uQ),$.updateMatrixWorld(),Z.makeTranslation(-L6.x,-L6.y,-L6.z),NW.multiplyMatrices($.projectionMatrix,$.matrixWorldInverse),this._frustum.setFromProjectionMatrix(NW,$.coordinateSystem,$.reversedDepth)}}class WQ extends Y6{constructor(J,Q,$=0,Z=2){super(J,Q);this.isPointLight=!0,this.type="PointLight",this.distance=$,this.decay=Z,this.shadow=new LH}get power(){return this.intensity*4*Math.PI}set power(J){this.intensity=J/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(J,Q){return super.copy(J,Q),this.distance=J.distance,this.decay=J.decay,this.shadow=J.shadow.clone(),this}}class $9 extends p7{constructor(J=-1,Q=1,$=1,Z=-1,W=0.1,H=2000){super();this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=J,this.right=Q,this.top=$,this.bottom=Z,this.near=W,this.far=H,this.updateProjectionMatrix()}copy(J,Q){return super.copy(J,Q),this.left=J.left,this.right=J.right,this.top=J.top,this.bottom=J.bottom,this.near=J.near,this.far=J.far,this.zoom=J.zoom,this.view=J.view===null?null:Object.assign({},J.view),this}setViewOffset(J,Q,$,Z,W,H){if(this.view===null)this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1};this.view.enabled=!0,this.view.fullWidth=J,this.view.fullHeight=Q,this.view.offsetX=$,this.view.offsetY=Z,this.view.width=W,this.view.height=H,this.updateProjectionMatrix()}clearViewOffset(){if(this.view!==null)this.view.enabled=!1;this.updateProjectionMatrix()}updateProjectionMatrix(){let J=(this.right-this.left)/(2*this.zoom),Q=(this.top-this.bottom)/(2*this.zoom),$=(this.right+this.left)/2,Z=(this.top+this.bottom)/2,W=$-J,H=$+J,Y=Z+Q,X=Z-Q;if(this.view!==null&&this.view.enabled){let K=(this.right-this.left)/this.view.fullWidth/this.zoom,U=(this.top-this.bottom)/this.view.fullHeight/this.zoom;W+=K*this.view.offsetX,H=W+K*this.view.width,Y-=U*this.view.offsetY,X=Y-U*this.view.height}this.projectionMatrix.makeOrthographic(W,H,Y,X,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(J){let Q=super.toJSON(J);if(Q.object.zoom=this.zoom,Q.object.left=this.left,Q.object.right=this.right,Q.object.top=this.top,Q.object.bottom=this.bottom,Q.object.near=this.near,Q.object.far=this.far,this.view!==null)Q.object.view=Object.assign({},this.view);return Q}}class VH extends $Q{constructor(){super(new $9(-5,5,5,-5,0.5,500));this.isDirectionalLightShadow=!0}}class V9 extends Y6{constructor(J,Q){super(J,Q);this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(YJ.DEFAULT_UP),this.updateMatrix(),this.target=new YJ,this.shadow=new VH}dispose(){this.shadow.dispose()}copy(J){return super.copy(J),this.target=J.target.clone(),this.shadow=J.shadow.clone(),this}}class Z9{static extractUrlBase(J){let Q=J.lastIndexOf("/");if(Q===-1)return"./";return J.slice(0,Q+1)}static resolveURL(J,Q){if(typeof J!=="string"||J==="")return"";if(/^https?:\/\//i.test(Q)&&/^\//.test(J))Q=Q.replace(/(^https?:\/\/[^\/]+).*/i,"$1");if(/^(https?:)?\/\//i.test(J))return J;if(/^data:.*,.*$/i.test(J))return J;if(/^blob:.*$/i.test(J))return J;return Q+J}}var cQ=new WeakMap;class HQ extends p8{constructor(J){super(J);if(this.isImageBitmapLoader=!0,typeof createImageBitmap>"u")console.warn("THREE.ImageBitmapLoader: createImageBitmap() not supported.");if(typeof fetch>"u")console.warn("THREE.ImageBitmapLoader: fetch() not supported.");this.options={premultiplyAlpha:"none"},this._abortController=new AbortController}setOptions(J){return this.options=J,this}load(J,Q,$,Z){if(J===void 0)J="";if(this.path!==void 0)J=this.path+J;J=this.manager.resolveURL(J);let W=this,H=M8.get(`image-bitmap:${J}`);if(H!==void 0){if(W.manager.itemStart(J),H.then){H.then((K)=>{if(cQ.has(H)===!0){if(Z)Z(cQ.get(H));W.manager.itemError(J),W.manager.itemEnd(J)}else{if(Q)Q(K);return W.manager.itemEnd(J),K}});return}return setTimeout(function(){if(Q)Q(H);W.manager.itemEnd(J)},0),H}let Y={};Y.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",Y.headers=this.requestHeader,Y.signal=typeof AbortSignal.any==="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal;let X=fetch(J,Y).then(function(K){return K.blob()}).then(function(K){return createImageBitmap(K,Object.assign(W.options,{colorSpaceConversion:"none"}))}).then(function(K){if(M8.add(`image-bitmap:${J}`,K),Q)Q(K);return W.manager.itemEnd(J),K}).catch(function(K){if(Z)Z(K);cQ.set(X,K),M8.remove(`image-bitmap:${J}`),W.manager.itemError(J),W.manager.itemEnd(J)});M8.add(`image-bitmap:${J}`,X),W.manager.itemStart(J)}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}}class QZ extends TJ{constructor(J=[]){super();this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=J}}var $Z="\\[\\]\\.:\\/",dX=new RegExp("["+$Z+"]","g"),ZZ="[^"+$Z+"]",mX="[^"+$Z.replace("\\.","")+"]",uX=/((?:WC+[\/:])*)/.source.replace("WC",ZZ),cX=/(WCOD+)?/.source.replace("WCOD",mX),nX=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",ZZ),sX=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",ZZ),oX=new RegExp("^"+uX+cX+nX+sX+"$"),iX=["material","materials","bones","map"];class zH{constructor(J,Q,$){let Z=$||r0.parseTrackName(Q);this._targetGroup=J,this._bindings=J.subscribe_(Q,Z)}getValue(J,Q){this.bind();let $=this._targetGroup.nCachedObjects_,Z=this._bindings[$];if(Z!==void 0)Z.getValue(J,Q)}setValue(J,Q){let $=this._bindings;for(let Z=this._targetGroup.nCachedObjects_,W=$.length;Z!==W;++Z)$[Z].setValue(J,Q)}bind(){let J=this._bindings;for(let Q=this._targetGroup.nCachedObjects_,$=J.length;Q!==$;++Q)J[Q].bind()}unbind(){let J=this._bindings;for(let Q=this._targetGroup.nCachedObjects_,$=J.length;Q!==$;++Q)J[Q].unbind()}}class r0{constructor(J,Q,$){this.path=Q,this.parsedPath=$||r0.parseTrackName(Q),this.node=r0.findNode(J,this.parsedPath.nodeName),this.rootNode=J,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(J,Q,$){if(!(J&&J.isAnimationObjectGroup))return new r0(J,Q,$);else return new r0.Composite(J,Q,$)}static sanitizeNodeName(J){return J.replace(/\s/g,"_").replace(dX,"")}static parseTrackName(J){let Q=oX.exec(J);if(Q===null)throw Error("PropertyBinding: Cannot parse trackName: "+J);let $={nodeName:Q[2],objectName:Q[3],objectIndex:Q[4],propertyName:Q[5],propertyIndex:Q[6]},Z=$.nodeName&&$.nodeName.lastIndexOf(".");if(Z!==void 0&&Z!==-1){let W=$.nodeName.substring(Z+1);if(iX.indexOf(W)!==-1)$.nodeName=$.nodeName.substring(0,Z),$.objectName=W}if($.propertyName===null||$.propertyName.length===0)throw Error("PropertyBinding: can not parse propertyName from trackName: "+J);return $}static findNode(J,Q){if(Q===void 0||Q===""||Q==="."||Q===-1||Q===J.name||Q===J.uuid)return J;if(J.skeleton){let $=J.skeleton.getBoneByName(Q);if($!==void 0)return $}if(J.children){let $=function(W){for(let H=0;H<W.length;H++){let Y=W[H];if(Y.name===Q||Y.uuid===Q)return Y;let X=$(Y.children);if(X)return X}return null},Z=$(J.children);if(Z)return Z}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(J,Q){J[Q]=this.targetObject[this.propertyName]}_getValue_array(J,Q){let $=this.resolvedProperty;for(let Z=0,W=$.length;Z!==W;++Z)J[Q++]=$[Z]}_getValue_arrayElement(J,Q){J[Q]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(J,Q){this.resolvedProperty.toArray(J,Q)}_setValue_direct(J,Q){this.targetObject[this.propertyName]=J[Q]}_setValue_direct_setNeedsUpdate(J,Q){this.targetObject[this.propertyName]=J[Q],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(J,Q){this.targetObject[this.propertyName]=J[Q],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(J,Q){let $=this.resolvedProperty;for(let Z=0,W=$.length;Z!==W;++Z)$[Z]=J[Q++]}_setValue_array_setNeedsUpdate(J,Q){let $=this.resolvedProperty;for(let Z=0,W=$.length;Z!==W;++Z)$[Z]=J[Q++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(J,Q){let $=this.resolvedProperty;for(let Z=0,W=$.length;Z!==W;++Z)$[Z]=J[Q++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(J,Q){this.resolvedProperty[this.propertyIndex]=J[Q]}_setValue_arrayElement_setNeedsUpdate(J,Q){this.resolvedProperty[this.propertyIndex]=J[Q],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(J,Q){this.resolvedProperty[this.propertyIndex]=J[Q],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(J,Q){this.resolvedProperty.fromArray(J,Q)}_setValue_fromArray_setNeedsUpdate(J,Q){this.resolvedProperty.fromArray(J,Q),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(J,Q){this.resolvedProperty.fromArray(J,Q),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(J,Q){this.bind(),this.getValue(J,Q)}_setValue_unbound(J,Q){this.bind(),this.setValue(J,Q)}bind(){let J=this.node,Q=this.parsedPath,$=Q.objectName,Z=Q.propertyName,W=Q.propertyIndex;if(!J)J=r0.findNode(this.rootNode,Q.nodeName),this.node=J;if(this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!J){console.warn("THREE.PropertyBinding: No target node found for track: "+this.path+".");return}if($){let K=Q.objectIndex;switch($){case"materials":if(!J.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!J.material.materials){console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}J=J.material.materials;break;case"bones":if(!J.skeleton){console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}J=J.skeleton.bones;for(let U=0;U<J.length;U++)if(J[U].name===K){K=U;break}break;case"map":if("map"in J){J=J.map;break}if(!J.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!J.material.map){console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}J=J.material.map;break;default:if(J[$]===void 0){console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);return}J=J[$]}if(K!==void 0){if(J[K]===void 0){console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,J);return}J=J[K]}}let H=J[Z];if(H===void 0){let K=Q.nodeName;console.error("THREE.PropertyBinding: Trying to update property for track: "+K+"."+Z+" but it wasn't found.",J);return}let Y=this.Versioning.None;if(this.targetObject=J,J.isMaterial===!0)Y=this.Versioning.NeedsUpdate;else if(J.isObject3D===!0)Y=this.Versioning.MatrixWorldNeedsUpdate;let X=this.BindingType.Direct;if(W!==void 0){if(Z==="morphTargetInfluences"){if(!J.geometry){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!J.geometry.morphAttributes){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}if(J.morphTargetDictionary[W]!==void 0)W=J.morphTargetDictionary[W]}X=this.BindingType.ArrayElement,this.resolvedProperty=H,this.propertyIndex=W}else if(H.fromArray!==void 0&&H.toArray!==void 0)X=this.BindingType.HasFromToArray,this.resolvedProperty=H;else if(Array.isArray(H))X=this.BindingType.EntireArray,this.resolvedProperty=H;else this.propertyName=Z;this.getValue=this.GetterByBindingType[X],this.setValue=this.SetterByBindingTypeAndVersioning[X][Y]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}}r0.Composite=zH;r0.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};r0.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};r0.prototype.GetterByBindingType=[r0.prototype._getValue_direct,r0.prototype._getValue_array,r0.prototype._getValue_arrayElement,r0.prototype._getValue_toArray];r0.prototype.SetterByBindingTypeAndVersioning=[[r0.prototype._setValue_direct,r0.prototype._setValue_direct_setNeedsUpdate,r0.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[r0.prototype._setValue_array,r0.prototype._setValue_array_setNeedsUpdate,r0.prototype._setValue_array_setMatrixWorldNeedsUpdate],[r0.prototype._setValue_arrayElement,r0.prototype._setValue_arrayElement_setNeedsUpdate,r0.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[r0.prototype._setValue_fromArray,r0.prototype._setValue_fromArray_setNeedsUpdate,r0.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var JE=new Float32Array(1);var FW=new j0;class YQ{constructor(J,Q,$=0,Z=1/0){this.ray=new F8(J,Q),this.near=$,this.far=Z,this.camera=null,this.layers=new S6,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(J,Q){this.ray.set(J,Q)}setFromCamera(J,Q){if(Q.isPerspectiveCamera)this.ray.origin.setFromMatrixPosition(Q.matrixWorld),this.ray.direction.set(J.x,J.y,0.5).unproject(Q).sub(this.ray.origin).normalize(),this.camera=Q;else if(Q.isOrthographicCamera)this.ray.origin.set(J.x,J.y,(Q.near+Q.far)/(Q.near-Q.far)).unproject(Q),this.ray.direction.set(0,0,-1).transformDirection(Q.matrixWorld),this.camera=Q;else console.error("THREE.Raycaster: Unsupported camera type: "+Q.type)}setFromXRController(J){return FW.identity().extractRotation(J.matrixWorld),this.ray.origin.setFromMatrixPosition(J.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(FW),this}intersectObject(J,Q=!0,$=[]){return sQ(J,this,$,Q),$.sort(OW),$}intersectObjects(J,Q=!0,$=[]){for(let Z=0,W=J.length;Z<W;Z++)sQ(J[Z],this,$,Q);return $.sort(OW),$}}function OW(J,Q){return J.distance-Q.distance}function sQ(J,Q,$,Z){let W=!0;if(J.layers.test(Q.layers)){if(J.raycast(Q,$)===!1)W=!1}if(W===!0&&Z===!0){let H=J.children;for(let Y=0,X=H.length;Y<X;Y++)sQ(H[Y],Q,$,!0)}}class z9{constructor(J=1,Q=0,$=0){this.radius=J,this.phi=Q,this.theta=$}set(J,Q,$){return this.radius=J,this.phi=Q,this.theta=$,this}copy(J){return this.radius=J.radius,this.phi=J.phi,this.theta=J.theta,this}makeSafe(){return this.phi=d0(this.phi,0.000001,Math.PI-0.000001),this}setFromVector3(J){return this.setFromCartesianCoords(J.x,J.y,J.z)}setFromCartesianCoords(J,Q,$){if(this.radius=Math.sqrt(J*J+Q*Q+$*$),this.radius===0)this.theta=0,this.phi=0;else this.theta=Math.atan2(J,$),this.phi=Math.acos(d0(Q/this.radius,-1,1));return this}clone(){return new this.constructor().copy(this)}}class XQ extends x8{constructor(J,Q=null){super();this.object=J,this.domElement=Q,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(J){if(J===void 0){console.warn("THREE.Controls: connect() now requires an element.");return}if(this.domElement!==null)this.disconnect();this.domElement=J}disconnect(){}dispose(){}update(){}}function WZ(J,Q,$,Z){let W=aX(Z);switch($){case 1021:return J*Q;case 1028:return J*Q/W.components*W.byteLength;case 1029:return J*Q/W.components*W.byteLength;case 1030:return J*Q*2/W.components*W.byteLength;case 1031:return J*Q*2/W.components*W.byteLength;case 1022:return J*Q*3/W.components*W.byteLength;case 1023:return J*Q*4/W.components*W.byteLength;case 1033:return J*Q*4/W.components*W.byteLength;case 33776:case 33777:return Math.floor((J+3)/4)*Math.floor((Q+3)/4)*8;case 33778:case 33779:return Math.floor((J+3)/4)*Math.floor((Q+3)/4)*16;case 35841:case 35843:return Math.max(J,16)*Math.max(Q,8)/4;case 35840:case 35842:return Math.max(J,8)*Math.max(Q,8)/2;case 36196:case 37492:return Math.floor((J+3)/4)*Math.floor((Q+3)/4)*8;case 37496:return Math.floor((J+3)/4)*Math.floor((Q+3)/4)*16;case 37808:return Math.floor((J+3)/4)*Math.floor((Q+3)/4)*16;case 37809:return Math.floor((J+4)/5)*Math.floor((Q+3)/4)*16;case 37810:return Math.floor((J+4)/5)*Math.floor((Q+4)/5)*16;case 37811:return Math.floor((J+5)/6)*Math.floor((Q+4)/5)*16;case 37812:return Math.floor((J+5)/6)*Math.floor((Q+5)/6)*16;case 37813:return Math.floor((J+7)/8)*Math.floor((Q+4)/5)*16;case 37814:return Math.floor((J+7)/8)*Math.floor((Q+5)/6)*16;case 37815:return Math.floor((J+7)/8)*Math.floor((Q+7)/8)*16;case 37816:return Math.floor((J+9)/10)*Math.floor((Q+4)/5)*16;case 37817:return Math.floor((J+9)/10)*Math.floor((Q+5)/6)*16;case 37818:return Math.floor((J+9)/10)*Math.floor((Q+7)/8)*16;case 37819:return Math.floor((J+9)/10)*Math.floor((Q+9)/10)*16;case 37820:return Math.floor((J+11)/12)*Math.floor((Q+9)/10)*16;case 37821:return Math.floor((J+11)/12)*Math.floor((Q+11)/12)*16;case 36492:case 36494:case 36495:return Math.ceil(J/4)*Math.ceil(Q/4)*16;case 36283:case 36284:return Math.ceil(J/4)*Math.ceil(Q/4)*8;case 36285:case 36286:return Math.ceil(J/4)*Math.ceil(Q/4)*16}throw Error(`Unable to determine texture byte length for ${$} format.`)}function aX(J){switch(J){case 1009:case 1010:return{byteLength:1,components:1};case 1012:case 1011:case 1016:return{byteLength:2,components:1};case 1017:case 1018:return{byteLength:2,components:4};case 1014:case 1013:case 1015:return{byteLength:4,components:1};case 35902:case 35899:return{byteLength:4,components:3}}throw Error(`Unknown texture type ${J}.`)}if(typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"180"}}));if(typeof window<"u")if(window.__THREE__)console.warn("WARNING: Multiple instances of Three.js being imported.");else window.__THREE__="180";function nH(){let J=null,Q=!1,$=null,Z=null;function W(H,Y){$(H,Y),Z=J.requestAnimationFrame(W)}return{start:function(){if(Q===!0)return;if($===null)return;Z=J.requestAnimationFrame(W),Q=!0},stop:function(){J.cancelAnimationFrame(Z),Q=!1},setAnimationLoop:function(H){$=H},setContext:function(H){J=H}}}function rX(J){let Q=new WeakMap;function $(X,K){let{array:U,usage:G}=X,q=U.byteLength,E=J.createBuffer();J.bindBuffer(K,E),J.bufferData(K,U,G),X.onUploadCallback();let O;if(U instanceof Float32Array)O=J.FLOAT;else if(typeof Float16Array<"u"&&U instanceof Float16Array)O=J.HALF_FLOAT;else if(U instanceof Uint16Array)if(X.isFloat16BufferAttribute)O=J.HALF_FLOAT;else O=J.UNSIGNED_SHORT;else if(U instanceof Int16Array)O=J.SHORT;else if(U instanceof Uint32Array)O=J.UNSIGNED_INT;else if(U instanceof Int32Array)O=J.INT;else if(U instanceof Int8Array)O=J.BYTE;else if(U instanceof Uint8Array)O=J.UNSIGNED_BYTE;else if(U instanceof Uint8ClampedArray)O=J.UNSIGNED_BYTE;else throw Error("THREE.WebGLAttributes: Unsupported buffer data format: "+U);return{buffer:E,type:O,bytesPerElement:U.BYTES_PER_ELEMENT,version:X.version,size:q}}function Z(X,K,U){let{array:G,updateRanges:q}=K;if(J.bindBuffer(U,X),q.length===0)J.bufferSubData(U,0,G);else{q.sort((O,D)=>O.start-D.start);let E=0;for(let O=1;O<q.length;O++){let D=q[E],k=q[O];if(k.start<=D.start+D.count+1)D.count=Math.max(D.count,k.start+k.count-D.start);else++E,q[E]=k}q.length=E+1;for(let O=0,D=q.length;O<D;O++){let k=q[O];J.bufferSubData(U,k.start*G.BYTES_PER_ELEMENT,G,k.start,k.count)}K.clearUpdateRanges()}K.onUploadCallback()}function W(X){if(X.isInterleavedBufferAttribute)X=X.data;return Q.get(X)}function H(X){if(X.isInterleavedBufferAttribute)X=X.data;let K=Q.get(X);if(K)J.deleteBuffer(K.buffer),Q.delete(X)}function Y(X,K){if(X.isInterleavedBufferAttribute)X=X.data;if(X.isGLBufferAttribute){let G=Q.get(X);if(!G||G.version<X.version)Q.set(X,{buffer:X.buffer,type:X.type,bytesPerElement:X.elementSize,version:X.version});return}let U=Q.get(X);if(U===void 0)Q.set(X,$(X,K));else if(U.version<X.version){if(U.size!==X.array.byteLength)throw Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");Z(U.buffer,X,K),U.version=X.version}}return{get:W,remove:H,update:Y}}var tX=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,eX=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,JK=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,QK=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,$K=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,ZK=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,WK=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,HK=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,YK=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,XK=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,KK=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,UK=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,GK=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,qK=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,EK=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,NK=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,FK=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,OK=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,RK=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,kK=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,DK=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,MK=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,LK=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,VK=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,zK=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,BK=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,CK=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,_K=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,wK=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,IK=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,PK="gl_FragColor = linearToOutputTexel( gl_FragColor );",TK=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,AK=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,SK=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,jK=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,yK=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,vK=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,fK=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,hK=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,xK=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,bK=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,gK=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,pK=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,lK=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,dK=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,mK=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,uK=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,cK=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,nK=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,sK=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,oK=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,iK=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,aK=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,rK=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,tK=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,eK=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,JU=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,QU=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,$U=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,ZU=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,WU=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,HU=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,YU=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,XU=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,KU=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,UU=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,GU=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,qU=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,EU=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,NU=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,FU=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,OU=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,RU=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,kU=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,DU=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,MU=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,LU=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,VU=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,zU=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,BU=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,CU=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,_U=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,wU=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,IU=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,PU=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,TU=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,AU=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,SU=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,jU=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,yU=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		float depth = unpackRGBAToDepth( texture2D( depths, uv ) );
		#ifdef USE_REVERSED_DEPTH_BUFFER
			return step( depth, compare );
		#else
			return step( compare, depth );
		#endif
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow( sampler2D shadow, vec2 uv, float compare ) {
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		#ifdef USE_REVERSED_DEPTH_BUFFER
			float hard_shadow = step( distribution.x, compare );
		#else
			float hard_shadow = step( compare, distribution.x );
		#endif
		if ( hard_shadow != 1.0 ) {
			float distance = compare - distribution.x;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,vU=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,fU=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,hU=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,xU=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,bU=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,gU=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,pU=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,lU=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,dU=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,mU=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,uU=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,cU=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,nU=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,sU=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,oU=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,iU=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,aU=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,rU=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,tU=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,eU=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,JG=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,QG=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,$G=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,ZG=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,WG=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,HG=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,YG=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,XG=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,KG=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,UG=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,GG=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,qG=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,EG=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,NG=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,FG=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,OG=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,RG=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,kG=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,DG=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,MG=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,LG=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,VG=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,zG=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,BG=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,CG=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,_G=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,wG=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,IG=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,PG=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,TG=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,AG=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,p0={alphahash_fragment:tX,alphahash_pars_fragment:eX,alphamap_fragment:JK,alphamap_pars_fragment:QK,alphatest_fragment:$K,alphatest_pars_fragment:ZK,aomap_fragment:WK,aomap_pars_fragment:HK,batching_pars_vertex:YK,batching_vertex:XK,begin_vertex:KK,beginnormal_vertex:UK,bsdfs:GK,iridescence_fragment:qK,bumpmap_pars_fragment:EK,clipping_planes_fragment:NK,clipping_planes_pars_fragment:FK,clipping_planes_pars_vertex:OK,clipping_planes_vertex:RK,color_fragment:kK,color_pars_fragment:DK,color_pars_vertex:MK,color_vertex:LK,common:VK,cube_uv_reflection_fragment:zK,defaultnormal_vertex:BK,displacementmap_pars_vertex:CK,displacementmap_vertex:_K,emissivemap_fragment:wK,emissivemap_pars_fragment:IK,colorspace_fragment:PK,colorspace_pars_fragment:TK,envmap_fragment:AK,envmap_common_pars_fragment:SK,envmap_pars_fragment:jK,envmap_pars_vertex:yK,envmap_physical_pars_fragment:uK,envmap_vertex:vK,fog_vertex:fK,fog_pars_vertex:hK,fog_fragment:xK,fog_pars_fragment:bK,gradientmap_pars_fragment:gK,lightmap_pars_fragment:pK,lights_lambert_fragment:lK,lights_lambert_pars_fragment:dK,lights_pars_begin:mK,lights_toon_fragment:cK,lights_toon_pars_fragment:nK,lights_phong_fragment:sK,lights_phong_pars_fragment:oK,lights_physical_fragment:iK,lights_physical_pars_fragment:aK,lights_fragment_begin:rK,lights_fragment_maps:tK,lights_fragment_end:eK,logdepthbuf_fragment:JU,logdepthbuf_pars_fragment:QU,logdepthbuf_pars_vertex:$U,logdepthbuf_vertex:ZU,map_fragment:WU,map_pars_fragment:HU,map_particle_fragment:YU,map_particle_pars_fragment:XU,metalnessmap_fragment:KU,metalnessmap_pars_fragment:UU,morphinstance_vertex:GU,morphcolor_vertex:qU,morphnormal_vertex:EU,morphtarget_pars_vertex:NU,morphtarget_vertex:FU,normal_fragment_begin:OU,normal_fragment_maps:RU,normal_pars_fragment:kU,normal_pars_vertex:DU,normal_vertex:MU,normalmap_pars_fragment:LU,clearcoat_normal_fragment_begin:VU,clearcoat_normal_fragment_maps:zU,clearcoat_pars_fragment:BU,iridescence_pars_fragment:CU,opaque_fragment:_U,packing:wU,premultiplied_alpha_fragment:IU,project_vertex:PU,dithering_fragment:TU,dithering_pars_fragment:AU,roughnessmap_fragment:SU,roughnessmap_pars_fragment:jU,shadowmap_pars_fragment:yU,shadowmap_pars_vertex:vU,shadowmap_vertex:fU,shadowmask_pars_fragment:hU,skinbase_vertex:xU,skinning_pars_vertex:bU,skinning_vertex:gU,skinnormal_vertex:pU,specularmap_fragment:lU,specularmap_pars_fragment:dU,tonemapping_fragment:mU,tonemapping_pars_fragment:uU,transmission_fragment:cU,transmission_pars_fragment:nU,uv_pars_fragment:sU,uv_pars_vertex:oU,uv_vertex:iU,worldpos_vertex:aU,background_vert:rU,background_frag:tU,backgroundCube_vert:eU,backgroundCube_frag:JG,cube_vert:QG,cube_frag:$G,depth_vert:ZG,depth_frag:WG,distanceRGBA_vert:HG,distanceRGBA_frag:YG,equirect_vert:XG,equirect_frag:KG,linedashed_vert:UG,linedashed_frag:GG,meshbasic_vert:qG,meshbasic_frag:EG,meshlambert_vert:NG,meshlambert_frag:FG,meshmatcap_vert:OG,meshmatcap_frag:RG,meshnormal_vert:kG,meshnormal_frag:DG,meshphong_vert:MG,meshphong_frag:LG,meshphysical_vert:VG,meshphysical_frag:zG,meshtoon_vert:BG,meshtoon_frag:CG,points_vert:_G,points_frag:wG,shadow_vert:IG,shadow_frag:PG,sprite_vert:TG,sprite_frag:AG},Y0={common:{diffuse:{value:new P0(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new f0},alphaMap:{value:null},alphaMapTransform:{value:new f0},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new f0}},envmap:{envMap:{value:null},envMapRotation:{value:new f0},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:0.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new f0}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new f0}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new f0},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new f0},normalScale:{value:new _0(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new f0},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new f0}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new f0}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new f0}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:0.00025},fogNear:{value:1},fogFar:{value:2000},fogColor:{value:new P0(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new P0(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new f0},alphaTest:{value:0},uvTransform:{value:new f0}},sprite:{diffuse:{value:new P0(16777215)},opacity:{value:1},center:{value:new _0(0.5,0.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new f0},alphaMap:{value:null},alphaMapTransform:{value:new f0},alphaTest:{value:0}}},B8={basic:{uniforms:yJ([Y0.common,Y0.specularmap,Y0.envmap,Y0.aomap,Y0.lightmap,Y0.fog]),vertexShader:p0.meshbasic_vert,fragmentShader:p0.meshbasic_frag},lambert:{uniforms:yJ([Y0.common,Y0.specularmap,Y0.envmap,Y0.aomap,Y0.lightmap,Y0.emissivemap,Y0.bumpmap,Y0.normalmap,Y0.displacementmap,Y0.fog,Y0.lights,{emissive:{value:new P0(0)}}]),vertexShader:p0.meshlambert_vert,fragmentShader:p0.meshlambert_frag},phong:{uniforms:yJ([Y0.common,Y0.specularmap,Y0.envmap,Y0.aomap,Y0.lightmap,Y0.emissivemap,Y0.bumpmap,Y0.normalmap,Y0.displacementmap,Y0.fog,Y0.lights,{emissive:{value:new P0(0)},specular:{value:new P0(1118481)},shininess:{value:30}}]),vertexShader:p0.meshphong_vert,fragmentShader:p0.meshphong_frag},standard:{uniforms:yJ([Y0.common,Y0.envmap,Y0.aomap,Y0.lightmap,Y0.emissivemap,Y0.bumpmap,Y0.normalmap,Y0.displacementmap,Y0.roughnessmap,Y0.metalnessmap,Y0.fog,Y0.lights,{emissive:{value:new P0(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:p0.meshphysical_vert,fragmentShader:p0.meshphysical_frag},toon:{uniforms:yJ([Y0.common,Y0.aomap,Y0.lightmap,Y0.emissivemap,Y0.bumpmap,Y0.normalmap,Y0.displacementmap,Y0.gradientmap,Y0.fog,Y0.lights,{emissive:{value:new P0(0)}}]),vertexShader:p0.meshtoon_vert,fragmentShader:p0.meshtoon_frag},matcap:{uniforms:yJ([Y0.common,Y0.bumpmap,Y0.normalmap,Y0.displacementmap,Y0.fog,{matcap:{value:null}}]),vertexShader:p0.meshmatcap_vert,fragmentShader:p0.meshmatcap_frag},points:{uniforms:yJ([Y0.points,Y0.fog]),vertexShader:p0.points_vert,fragmentShader:p0.points_frag},dashed:{uniforms:yJ([Y0.common,Y0.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:p0.linedashed_vert,fragmentShader:p0.linedashed_frag},depth:{uniforms:yJ([Y0.common,Y0.displacementmap]),vertexShader:p0.depth_vert,fragmentShader:p0.depth_frag},normal:{uniforms:yJ([Y0.common,Y0.bumpmap,Y0.normalmap,Y0.displacementmap,{opacity:{value:1}}]),vertexShader:p0.meshnormal_vert,fragmentShader:p0.meshnormal_frag},sprite:{uniforms:yJ([Y0.sprite,Y0.fog]),vertexShader:p0.sprite_vert,fragmentShader:p0.sprite_frag},background:{uniforms:{uvTransform:{value:new f0},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:p0.background_vert,fragmentShader:p0.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new f0}},vertexShader:p0.backgroundCube_vert,fragmentShader:p0.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:p0.cube_vert,fragmentShader:p0.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:p0.equirect_vert,fragmentShader:p0.equirect_frag},distanceRGBA:{uniforms:yJ([Y0.common,Y0.displacementmap,{referencePosition:{value:new P},nearDistance:{value:1},farDistance:{value:1000}}]),vertexShader:p0.distanceRGBA_vert,fragmentShader:p0.distanceRGBA_frag},shadow:{uniforms:yJ([Y0.lights,Y0.fog,{color:{value:new P0(0)},opacity:{value:1}}]),vertexShader:p0.shadow_vert,fragmentShader:p0.shadow_frag}};B8.physical={uniforms:yJ([B8.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new f0},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new f0},clearcoatNormalScale:{value:new _0(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new f0},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new f0},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new f0},sheen:{value:0},sheenColor:{value:new P0(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new f0},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new f0},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new f0},transmissionSamplerSize:{value:new _0},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new f0},attenuationDistance:{value:0},attenuationColor:{value:new P0(0)},specularColor:{value:new P0(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new f0},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new f0},anisotropyVector:{value:new _0},anisotropyMap:{value:null},anisotropyMapTransform:{value:new f0}}]),vertexShader:p0.meshphysical_vert,fragmentShader:p0.meshphysical_frag};var KQ={r:0,b:0,g:0},B9=new q8,SG=new j0;function jG(J,Q,$,Z,W,H,Y){let X=new P0(0),K=H===!0?0:1,U,G,q=null,E=0,O=null;function D(L){let _=L.isScene===!0?L.background:null;if(_&&_.isTexture)_=(L.backgroundBlurriness>0?$:Q).get(_);return _}function k(L){let _=!1,j=D(L);if(j===null)F(X,K);else if(j&&j.isColor)F(j,1),_=!0;let w=J.xr.getEnvironmentBlendMode();if(w==="additive")Z.buffers.color.setClear(0,0,0,1,Y);else if(w==="alpha-blend")Z.buffers.color.setClear(0,0,0,0,Y);if(J.autoClear||_)Z.buffers.depth.setTest(!0),Z.buffers.depth.setMask(!0),Z.buffers.color.setMask(!0),J.clear(J.autoClearColor,J.autoClearDepth,J.autoClearStencil)}function N(L,_){let j=D(_);if(j&&(j.isCubeTexture||j.mapping===_6)){if(G===void 0)G=new IJ(new $6(1,1,1),new z8({name:"BackgroundCubeMaterial",uniforms:M9(B8.backgroundCube.uniforms),vertexShader:B8.backgroundCube.vertexShader,fragmentShader:B8.backgroundCube.fragmentShader,side:uJ,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),G.geometry.deleteAttribute("normal"),G.geometry.deleteAttribute("uv"),G.onBeforeRender=function(w,S,p){this.matrixWorld.copyPosition(p.matrixWorld)},Object.defineProperty(G.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),W.update(G);if(B9.copy(_.backgroundRotation),B9.x*=-1,B9.y*=-1,B9.z*=-1,j.isCubeTexture&&j.isRenderTargetTexture===!1)B9.y*=-1,B9.z*=-1;if(G.material.uniforms.envMap.value=j,G.material.uniforms.flipEnvMap.value=j.isCubeTexture&&j.isRenderTargetTexture===!1?-1:1,G.material.uniforms.backgroundBlurriness.value=_.backgroundBlurriness,G.material.uniforms.backgroundIntensity.value=_.backgroundIntensity,G.material.uniforms.backgroundRotation.value.setFromMatrix4(SG.makeRotationFromEuler(B9)),G.material.toneMapped=n0.getTransfer(j.colorSpace)!==XJ,q!==j||E!==j.version||O!==J.toneMapping)G.material.needsUpdate=!0,q=j,E=j.version,O=J.toneMapping;G.layers.enableAll(),L.unshift(G,G.geometry,G.material,0,0,null)}else if(j&&j.isTexture){if(U===void 0)U=new IJ(new L9(2,2),new z8({name:"BackgroundMaterial",uniforms:M9(B8.background.uniforms),vertexShader:B8.background.vertexShader,fragmentShader:B8.background.fragmentShader,side:i8,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),U.geometry.deleteAttribute("normal"),Object.defineProperty(U.material,"map",{get:function(){return this.uniforms.t2D.value}}),W.update(U);if(U.material.uniforms.t2D.value=j,U.material.uniforms.backgroundIntensity.value=_.backgroundIntensity,U.material.toneMapped=n0.getTransfer(j.colorSpace)!==XJ,j.matrixAutoUpdate===!0)j.updateMatrix();if(U.material.uniforms.uvTransform.value.copy(j.matrix),q!==j||E!==j.version||O!==J.toneMapping)U.material.needsUpdate=!0,q=j,E=j.version,O=J.toneMapping;U.layers.enableAll(),L.unshift(U,U.geometry,U.material,0,0,null)}}function F(L,_){L.getRGB(KQ,u$(J)),Z.buffers.color.setClear(KQ.r,KQ.g,KQ.b,_,Y)}function C(){if(G!==void 0)G.geometry.dispose(),G.material.dispose(),G=void 0;if(U!==void 0)U.geometry.dispose(),U.material.dispose(),U=void 0}return{getClearColor:function(){return X},setClearColor:function(L,_=1){X.set(L),K=_,F(X,K)},getClearAlpha:function(){return K},setClearAlpha:function(L){K=L,F(X,K)},render:k,addToRenderList:N,dispose:C}}function yG(J,Q){let $=J.getParameter(J.MAX_VERTEX_ATTRIBS),Z={},W=E(null),H=W,Y=!1;function X(V,A,m,c,l){let i=!1,u=q(c,m,A);if(H!==u)H=u,U(H.object);if(i=O(V,c,m,l),i)D(V,c,m,l);if(l!==null)Q.update(l,J.ELEMENT_ARRAY_BUFFER);if(i||Y){if(Y=!1,_(V,A,m,c),l!==null)J.bindBuffer(J.ELEMENT_ARRAY_BUFFER,Q.get(l).buffer)}}function K(){return J.createVertexArray()}function U(V){return J.bindVertexArray(V)}function G(V){return J.deleteVertexArray(V)}function q(V,A,m){let c=m.wireframe===!0,l=Z[V.id];if(l===void 0)l={},Z[V.id]=l;let i=l[A.id];if(i===void 0)i={},l[A.id]=i;let u=i[c];if(u===void 0)u=E(K()),i[c]=u;return u}function E(V){let A=[],m=[],c=[];for(let l=0;l<$;l++)A[l]=0,m[l]=0,c[l]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:A,enabledAttributes:m,attributeDivisors:c,object:V,attributes:{},index:null}}function O(V,A,m,c){let l=H.attributes,i=A.attributes,u=0,r=m.getAttributes();for(let b in r)if(r[b].location>=0){let g=l[b],$0=i[b];if($0===void 0){if(b==="instanceMatrix"&&V.instanceMatrix)$0=V.instanceMatrix;if(b==="instanceColor"&&V.instanceColor)$0=V.instanceColor}if(g===void 0)return!0;if(g.attribute!==$0)return!0;if($0&&g.data!==$0.data)return!0;u++}if(H.attributesNum!==u)return!0;if(H.index!==c)return!0;return!1}function D(V,A,m,c){let l={},i=A.attributes,u=0,r=m.getAttributes();for(let b in r)if(r[b].location>=0){let g=i[b];if(g===void 0){if(b==="instanceMatrix"&&V.instanceMatrix)g=V.instanceMatrix;if(b==="instanceColor"&&V.instanceColor)g=V.instanceColor}let $0={};if($0.attribute=g,g&&g.data)$0.data=g.data;l[b]=$0,u++}H.attributes=l,H.attributesNum=u,H.index=c}function k(){let V=H.newAttributes;for(let A=0,m=V.length;A<m;A++)V[A]=0}function N(V){F(V,0)}function F(V,A){let{newAttributes:m,enabledAttributes:c,attributeDivisors:l}=H;if(m[V]=1,c[V]===0)J.enableVertexAttribArray(V),c[V]=1;if(l[V]!==A)J.vertexAttribDivisor(V,A),l[V]=A}function C(){let{newAttributes:V,enabledAttributes:A}=H;for(let m=0,c=A.length;m<c;m++)if(A[m]!==V[m])J.disableVertexAttribArray(m),A[m]=0}function L(V,A,m,c,l,i,u){if(u===!0)J.vertexAttribIPointer(V,A,m,l,i);else J.vertexAttribPointer(V,A,m,c,l,i)}function _(V,A,m,c){k();let l=c.attributes,i=m.getAttributes(),u=A.defaultAttributeValues;for(let r in i){let b=i[r];if(b.location>=0){let X0=l[r];if(X0===void 0){if(r==="instanceMatrix"&&V.instanceMatrix)X0=V.instanceMatrix;if(r==="instanceColor"&&V.instanceColor)X0=V.instanceColor}if(X0!==void 0){let{normalized:g,itemSize:$0}=X0,w0=Q.get(X0);if(w0===void 0)continue;let{buffer:u0,type:s0,bytesPerElement:n}=w0,W0=s0===J.INT||s0===J.UNSIGNED_INT||X0.gpuType===eQ;if(X0.isInterleavedBufferAttribute){let Q0=X0.data,M0=Q0.stride,S0=X0.offset;if(Q0.isInstancedInterleavedBuffer){for(let T0=0;T0<b.locationSize;T0++)F(b.location+T0,Q0.meshPerAttribute);if(V.isInstancedMesh!==!0&&c._maxInstanceCount===void 0)c._maxInstanceCount=Q0.meshPerAttribute*Q0.count}else for(let T0=0;T0<b.locationSize;T0++)N(b.location+T0);J.bindBuffer(J.ARRAY_BUFFER,u0);for(let T0=0;T0<b.locationSize;T0++)L(b.location+T0,$0/b.locationSize,s0,g,M0*n,(S0+$0/b.locationSize*T0)*n,W0)}else{if(X0.isInstancedBufferAttribute){for(let Q0=0;Q0<b.locationSize;Q0++)F(b.location+Q0,X0.meshPerAttribute);if(V.isInstancedMesh!==!0&&c._maxInstanceCount===void 0)c._maxInstanceCount=X0.meshPerAttribute*X0.count}else for(let Q0=0;Q0<b.locationSize;Q0++)N(b.location+Q0);J.bindBuffer(J.ARRAY_BUFFER,u0);for(let Q0=0;Q0<b.locationSize;Q0++)L(b.location+Q0,$0/b.locationSize,s0,g,$0*n,$0/b.locationSize*Q0*n,W0)}}else if(u!==void 0){let g=u[r];if(g!==void 0)switch(g.length){case 2:J.vertexAttrib2fv(b.location,g);break;case 3:J.vertexAttrib3fv(b.location,g);break;case 4:J.vertexAttrib4fv(b.location,g);break;default:J.vertexAttrib1fv(b.location,g)}}}}C()}function j(){p();for(let V in Z){let A=Z[V];for(let m in A){let c=A[m];for(let l in c)G(c[l].object),delete c[l];delete A[m]}delete Z[V]}}function w(V){if(Z[V.id]===void 0)return;let A=Z[V.id];for(let m in A){let c=A[m];for(let l in c)G(c[l].object),delete c[l];delete A[m]}delete Z[V.id]}function S(V){for(let A in Z){let m=Z[A];if(m[V.id]===void 0)continue;let c=m[V.id];for(let l in c)G(c[l].object),delete c[l];delete m[V.id]}}function p(){if(z(),Y=!0,H===W)return;H=W,U(H.object)}function z(){W.geometry=null,W.program=null,W.wireframe=!1}return{setup:X,reset:p,resetDefaultState:z,dispose:j,releaseStatesOfGeometry:w,releaseStatesOfProgram:S,initAttributes:k,enableAttribute:N,disableUnusedAttributes:C}}function vG(J,Q,$){let Z;function W(U){Z=U}function H(U,G){J.drawArrays(Z,U,G),$.update(G,Z,1)}function Y(U,G,q){if(q===0)return;J.drawArraysInstanced(Z,U,G,q),$.update(G,Z,q)}function X(U,G,q){if(q===0)return;Q.get("WEBGL_multi_draw").multiDrawArraysWEBGL(Z,U,0,G,0,q);let O=0;for(let D=0;D<q;D++)O+=G[D];$.update(O,Z,1)}function K(U,G,q,E){if(q===0)return;let O=Q.get("WEBGL_multi_draw");if(O===null)for(let D=0;D<U.length;D++)Y(U[D],G[D],E[D]);else{O.multiDrawArraysInstancedWEBGL(Z,U,0,G,0,E,0,q);let D=0;for(let k=0;k<q;k++)D+=G[k]*E[k];$.update(D,Z,1)}}this.setMode=W,this.render=H,this.renderInstances=Y,this.renderMultiDraw=X,this.renderMultiDrawInstances=K}function fG(J,Q,$,Z){let W;function H(){if(W!==void 0)return W;if(Q.has("EXT_texture_filter_anisotropic")===!0){let S=Q.get("EXT_texture_filter_anisotropic");W=J.getParameter(S.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else W=0;return W}function Y(S){if(S!==V8&&Z.convert(S)!==J.getParameter(J.IMPLEMENTATION_COLOR_READ_FORMAT))return!1;return!0}function X(S){let p=S===I6&&(Q.has("EXT_color_buffer_half_float")||Q.has("EXT_color_buffer_float"));if(S!==r8&&Z.convert(S)!==J.getParameter(J.IMPLEMENTATION_COLOR_READ_TYPE)&&S!==t8&&!p)return!1;return!0}function K(S){if(S==="highp"){if(J.getShaderPrecisionFormat(J.VERTEX_SHADER,J.HIGH_FLOAT).precision>0&&J.getShaderPrecisionFormat(J.FRAGMENT_SHADER,J.HIGH_FLOAT).precision>0)return"highp";S="mediump"}if(S==="mediump"){if(J.getShaderPrecisionFormat(J.VERTEX_SHADER,J.MEDIUM_FLOAT).precision>0&&J.getShaderPrecisionFormat(J.FRAGMENT_SHADER,J.MEDIUM_FLOAT).precision>0)return"mediump"}return"lowp"}let U=$.precision!==void 0?$.precision:"highp",G=K(U);if(G!==U)console.warn("THREE.WebGLRenderer:",U,"not supported, using",G,"instead."),U=G;let q=$.logarithmicDepthBuffer===!0,E=$.reversedDepthBuffer===!0&&Q.has("EXT_clip_control"),O=J.getParameter(J.MAX_TEXTURE_IMAGE_UNITS),D=J.getParameter(J.MAX_VERTEX_TEXTURE_IMAGE_UNITS),k=J.getParameter(J.MAX_TEXTURE_SIZE),N=J.getParameter(J.MAX_CUBE_MAP_TEXTURE_SIZE),F=J.getParameter(J.MAX_VERTEX_ATTRIBS),C=J.getParameter(J.MAX_VERTEX_UNIFORM_VECTORS),L=J.getParameter(J.MAX_VARYING_VECTORS),_=J.getParameter(J.MAX_FRAGMENT_UNIFORM_VECTORS),j=D>0,w=J.getParameter(J.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:H,getMaxPrecision:K,textureFormatReadable:Y,textureTypeReadable:X,precision:U,logarithmicDepthBuffer:q,reversedDepthBuffer:E,maxTextures:O,maxVertexTextures:D,maxTextureSize:k,maxCubemapSize:N,maxAttributes:F,maxVertexUniforms:C,maxVaryings:L,maxFragmentUniforms:_,vertexTextures:j,maxSamples:w}}function hG(J){let Q=this,$=null,Z=0,W=!1,H=!1,Y=new K8,X=new f0,K={value:null,needsUpdate:!1};this.uniform=K,this.numPlanes=0,this.numIntersection=0,this.init=function(q,E){let O=q.length!==0||E||Z!==0||W;return W=E,Z=q.length,O},this.beginShadows=function(){H=!0,G(null)},this.endShadows=function(){H=!1},this.setGlobalState=function(q,E){$=G(q,E,0)},this.setState=function(q,E,O){let{clippingPlanes:D,clipIntersection:k,clipShadows:N}=q,F=J.get(q);if(!W||D===null||D.length===0||H&&!N)if(H)G(null);else U();else{let C=H?0:Z,L=C*4,_=F.clippingState||null;K.value=_,_=G(D,E,L,O);for(let j=0;j!==L;++j)_[j]=$[j];F.clippingState=_,this.numIntersection=k?this.numPlanes:0,this.numPlanes+=C}};function U(){if(K.value!==$)K.value=$,K.needsUpdate=Z>0;Q.numPlanes=Z,Q.numIntersection=0}function G(q,E,O,D){let k=q!==null?q.length:0,N=null;if(k!==0){if(N=K.value,D!==!0||N===null){let F=O+k*4,C=E.matrixWorldInverse;if(X.getNormalMatrix(C),N===null||N.length<F)N=new Float32Array(F);for(let L=0,_=O;L!==k;++L,_+=4)Y.copy(q[L]).applyMatrix4(C,X),Y.normal.toArray(N,_),N[_+3]=Y.constant}K.value=N,K.needsUpdate=!0}return Q.numPlanes=k,Q.numIntersection=0,N}}function xG(J){let Q=new WeakMap;function $(Y,X){if(X===w7)Y.mapping=a9;else if(X===I7)Y.mapping=R9;return Y}function Z(Y){if(Y&&Y.isTexture){let X=Y.mapping;if(X===w7||X===I7)if(Q.has(Y)){let K=Q.get(Y).texture;return $(K,Y.mapping)}else{let K=Y.image;if(K&&K.height>0){let U=new n$(K.height);return U.fromEquirectangularTexture(J,Y),Q.set(Y,U),Y.addEventListener("dispose",W),$(U.texture,Y.mapping)}else return null}}return Y}function W(Y){let X=Y.target;X.removeEventListener("dispose",W);let K=Q.get(X);if(K!==void 0)Q.delete(X),K.dispose()}function H(){Q=new WeakMap}return{get:Z,dispose:H}}var K6=4,BH=[0.125,0.215,0.35,0.446,0.526,0.582],w9=20,HZ=new $9,CH=new P0,YZ=null,XZ=0,KZ=0,UZ=!1,_9=(1+Math.sqrt(5))/2,X6=1/_9,_H=[new P(-_9,X6,0),new P(_9,X6,0),new P(-X6,0,_9),new P(X6,0,_9),new P(0,_9,-X6),new P(0,_9,X6),new P(-1,1,-1),new P(1,1,-1),new P(-1,1,1),new P(1,1,1)],bG=new P;class qZ{constructor(J){this._renderer=J,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(J,Q=0,$=0.1,Z=100,W={}){let{size:H=256,position:Y=bG}=W;YZ=this._renderer.getRenderTarget(),XZ=this._renderer.getActiveCubeFace(),KZ=this._renderer.getActiveMipmapLevel(),UZ=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(H);let X=this._allocateTargets();if(X.depthBuffer=!0,this._sceneToCubeUV(J,$,Z,X,Y),Q>0)this._blur(X,0,0,Q);return this._applyPMREM(X),this._cleanup(X),X}fromEquirectangular(J,Q=null){return this._fromTexture(J,Q)}fromCubemap(J,Q=null){return this._fromTexture(J,Q)}compileCubemapShader(){if(this._cubemapMaterial===null)this._cubemapMaterial=PH(),this._compileMaterial(this._cubemapMaterial)}compileEquirectangularShader(){if(this._equirectMaterial===null)this._equirectMaterial=IH(),this._compileMaterial(this._equirectMaterial)}dispose(){if(this._dispose(),this._cubemapMaterial!==null)this._cubemapMaterial.dispose();if(this._equirectMaterial!==null)this._equirectMaterial.dispose()}_setSize(J){this._lodMax=Math.floor(Math.log2(J)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){if(this._blurMaterial!==null)this._blurMaterial.dispose();if(this._pingPongRenderTarget!==null)this._pingPongRenderTarget.dispose();for(let J=0;J<this._lodPlanes.length;J++)this._lodPlanes[J].dispose()}_cleanup(J){this._renderer.setRenderTarget(YZ,XZ,KZ),this._renderer.xr.enabled=UZ,J.scissorTest=!1,UQ(J,0,0,J.width,J.height)}_fromTexture(J,Q){if(J.mapping===a9||J.mapping===R9)this._setSize(J.image.length===0?16:J.image[0].width||J.image[0].image.width);else this._setSize(J.image.width/4);YZ=this._renderer.getRenderTarget(),XZ=this._renderer.getActiveCubeFace(),KZ=this._renderer.getActiveMipmapLevel(),UZ=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let $=Q||this._allocateTargets();return this._textureToCubeUV(J,$),this._applyPMREM($),this._cleanup($),$}_allocateTargets(){let J=3*Math.max(this._cubeSize,112),Q=4*this._cubeSize,$={magFilter:E8,minFilter:E8,generateMipmaps:!1,type:I6,format:V8,colorSpace:hJ,depthBuffer:!1},Z=wH(J,Q,$);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==J||this._pingPongRenderTarget.height!==Q){if(this._pingPongRenderTarget!==null)this._dispose();this._pingPongRenderTarget=wH(J,Q,$);let{_lodMax:W}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=gG(W)),this._blurMaterial=pG(W,J,Q)}return Z}_compileMaterial(J){let Q=new IJ(this._lodPlanes[0],J);this._renderer.compile(Q,HZ)}_sceneToCubeUV(J,Q,$,Z,W){let X=new TJ(90,1,Q,$),K=[1,-1,1,1,1,1],U=[1,1,1,-1,-1,-1],G=this._renderer,q=G.autoClear,E=G.toneMapping;if(G.getClearColor(CH),G.toneMapping=v8,G.autoClear=!1,G.state.buffers.depth.getReversed())G.setRenderTarget(Z),G.clearDepth(),G.setRenderTarget(null);let D=new Z8({name:"PMREM.Background",side:uJ,depthWrite:!1,depthTest:!1}),k=new IJ(new $6,D),N=!1,F=J.background;if(F){if(F.isColor)D.color.copy(F),J.background=null,N=!0}else D.color.copy(CH),N=!0;for(let C=0;C<6;C++){let L=C%3;if(L===0)X.up.set(0,K[C],0),X.position.set(W.x,W.y,W.z),X.lookAt(W.x+U[C],W.y,W.z);else if(L===1)X.up.set(0,0,K[C]),X.position.set(W.x,W.y,W.z),X.lookAt(W.x,W.y+U[C],W.z);else X.up.set(0,K[C],0),X.position.set(W.x,W.y,W.z),X.lookAt(W.x,W.y,W.z+U[C]);let _=this._cubeSize;if(UQ(Z,L*_,C>2?_:0,_,_),G.setRenderTarget(Z),N)G.render(k,X);G.render(J,X)}k.geometry.dispose(),k.material.dispose(),G.toneMapping=E,G.autoClear=q,J.background=F}_textureToCubeUV(J,Q){let $=this._renderer,Z=J.mapping===a9||J.mapping===R9;if(Z){if(this._cubemapMaterial===null)this._cubemapMaterial=PH();this._cubemapMaterial.uniforms.flipEnvMap.value=J.isRenderTargetTexture===!1?-1:1}else if(this._equirectMaterial===null)this._equirectMaterial=IH();let W=Z?this._cubemapMaterial:this._equirectMaterial,H=new IJ(this._lodPlanes[0],W),Y=W.uniforms;Y.envMap.value=J;let X=this._cubeSize;UQ(Q,0,0,3*X,2*X),$.setRenderTarget(Q),$.render(H,HZ)}_applyPMREM(J){let Q=this._renderer,$=Q.autoClear;Q.autoClear=!1;let Z=this._lodPlanes.length;for(let W=1;W<Z;W++){let H=Math.sqrt(this._sigmas[W]*this._sigmas[W]-this._sigmas[W-1]*this._sigmas[W-1]),Y=_H[(Z-W-1)%_H.length];this._blur(J,W-1,W,H,Y)}Q.autoClear=$}_blur(J,Q,$,Z,W){let H=this._pingPongRenderTarget;this._halfBlur(J,H,Q,$,Z,"latitudinal",W),this._halfBlur(H,J,$,$,Z,"longitudinal",W)}_halfBlur(J,Q,$,Z,W,H,Y){let X=this._renderer,K=this._blurMaterial;if(H!=="latitudinal"&&H!=="longitudinal")console.error("blur direction must be either latitudinal or longitudinal!");let U=3,G=new IJ(this._lodPlanes[Z],K),q=K.uniforms,E=this._sizeLods[$]-1,O=isFinite(W)?Math.PI/(2*E):2*Math.PI/(2*w9-1),D=W/O,k=isFinite(W)?1+Math.floor(U*D):w9;if(k>w9)console.warn(`sigmaRadians, ${W}, is too large and will clip, as it requested ${k} samples when the maximum is set to ${w9}`);let N=[],F=0;for(let w=0;w<w9;++w){let S=w/D,p=Math.exp(-S*S/2);if(N.push(p),w===0)F+=p;else if(w<k)F+=2*p}for(let w=0;w<N.length;w++)N[w]=N[w]/F;if(q.envMap.value=J.texture,q.samples.value=k,q.weights.value=N,q.latitudinal.value=H==="latitudinal",Y)q.poleAxis.value=Y;let{_lodMax:C}=this;q.dTheta.value=O,q.mipInt.value=C-$;let L=this._sizeLods[Z],_=3*L*(Z>C-K6?Z-C+K6:0),j=4*(this._cubeSize-L);UQ(Q,_,j,3*L,2*L),X.setRenderTarget(Q),X.render(G,HZ)}}function gG(J){let Q=[],$=[],Z=[],W=J,H=J-K6+1+BH.length;for(let Y=0;Y<H;Y++){let X=Math.pow(2,W);$.push(X);let K=1/X;if(Y>J-K6)K=BH[Y-J+K6-1];else if(Y===0)K=0;Z.push(K);let U=1/(X-2),G=-U,q=1+U,E=[G,G,q,G,q,q,G,G,q,q,G,q],O=6,D=6,k=3,N=2,F=1,C=new Float32Array(k*D*O),L=new Float32Array(N*D*O),_=new Float32Array(F*D*O);for(let w=0;w<O;w++){let S=w%3*2/3-1,p=w>2?0:-1,z=[S,p,0,S+0.6666666666666666,p,0,S+0.6666666666666666,p+1,0,S,p,0,S+0.6666666666666666,p+1,0,S,p+1,0];C.set(z,k*D*w),L.set(E,N*D*w);let V=[w,w,w,w,w,w];_.set(V,F*D*w)}let j=new oJ;if(j.setAttribute("position",new MJ(C,k)),j.setAttribute("uv",new MJ(L,N)),j.setAttribute("faceIndex",new MJ(_,F)),Q.push(j),W>K6)W--}return{lodPlanes:Q,sizeLods:$,sigmas:Z}}function wH(J,Q,$){let Z=new b8(J,Q,$);return Z.texture.mapping=_6,Z.texture.name="PMREM.cubeUv",Z.scissorTest=!0,Z}function UQ(J,Q,$,Z,W){J.viewport.set(Q,$,Z,W),J.scissor.set(Q,$,Z,W)}function pG(J,Q,$){let Z=new Float32Array(w9),W=new P(0,1,0);return new z8({name:"SphericalGaussianBlur",defines:{n:w9,CUBEUV_TEXEL_WIDTH:1/Q,CUBEUV_TEXEL_HEIGHT:1/$,CUBEUV_MAX_MIP:`${J}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:Z},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:W}},vertexShader:NZ(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:a8,depthTest:!1,depthWrite:!1})}function IH(){return new z8({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:NZ(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:a8,depthTest:!1,depthWrite:!1})}function PH(){return new z8({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:NZ(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:a8,depthTest:!1,depthWrite:!1})}function NZ(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function lG(J){let Q=new WeakMap,$=null;function Z(X){if(X&&X.isTexture){let K=X.mapping,U=K===w7||K===I7,G=K===a9||K===R9;if(U||G){let q=Q.get(X),E=q!==void 0?q.texture.pmremVersion:0;if(X.isRenderTargetTexture&&X.pmremVersion!==E){if($===null)$=new qZ(J);return q=U?$.fromEquirectangular(X,q):$.fromCubemap(X,q),q.texture.pmremVersion=X.pmremVersion,Q.set(X,q),q.texture}else if(q!==void 0)return q.texture;else{let O=X.image;if(U&&O&&O.height>0||G&&O&&W(O)){if($===null)$=new qZ(J);return q=U?$.fromEquirectangular(X):$.fromCubemap(X),q.texture.pmremVersion=X.pmremVersion,Q.set(X,q),X.addEventListener("dispose",H),q.texture}else return null}}}return X}function W(X){let K=0,U=6;for(let G=0;G<U;G++)if(X[G]!==void 0)K++;return K===U}function H(X){let K=X.target;K.removeEventListener("dispose",H);let U=Q.get(K);if(U!==void 0)Q.delete(K),U.dispose()}function Y(){if(Q=new WeakMap,$!==null)$.dispose(),$=null}return{get:Z,dispose:Y}}function dG(J){let Q={};function $(Z){if(Q[Z]!==void 0)return Q[Z];let W;switch(Z){case"WEBGL_depth_texture":W=J.getExtension("WEBGL_depth_texture")||J.getExtension("MOZ_WEBGL_depth_texture")||J.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":W=J.getExtension("EXT_texture_filter_anisotropic")||J.getExtension("MOZ_EXT_texture_filter_anisotropic")||J.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":W=J.getExtension("WEBGL_compressed_texture_s3tc")||J.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||J.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":W=J.getExtension("WEBGL_compressed_texture_pvrtc")||J.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:W=J.getExtension(Z)}return Q[Z]=W,W}return{has:function(Z){return $(Z)!==null},init:function(){$("EXT_color_buffer_float"),$("WEBGL_clip_cull_distance"),$("OES_texture_float_linear"),$("EXT_color_buffer_half_float"),$("WEBGL_multisampled_render_to_texture"),$("WEBGL_render_shared_exponent")},get:function(Z){let W=$(Z);if(W===null)o9("THREE.WebGLRenderer: "+Z+" extension not supported.");return W}}}function mG(J,Q,$,Z){let W={},H=new WeakMap;function Y(q){let E=q.target;if(E.index!==null)Q.remove(E.index);for(let D in E.attributes)Q.remove(E.attributes[D]);E.removeEventListener("dispose",Y),delete W[E.id];let O=H.get(E);if(O)Q.remove(O),H.delete(E);if(Z.releaseStatesOfGeometry(E),E.isInstancedBufferGeometry===!0)delete E._maxInstanceCount;$.memory.geometries--}function X(q,E){if(W[E.id]===!0)return E;return E.addEventListener("dispose",Y),W[E.id]=!0,$.memory.geometries++,E}function K(q){let E=q.attributes;for(let O in E)Q.update(E[O],J.ARRAY_BUFFER)}function U(q){let E=[],O=q.index,D=q.attributes.position,k=0;if(O!==null){let C=O.array;k=O.version;for(let L=0,_=C.length;L<_;L+=3){let j=C[L+0],w=C[L+1],S=C[L+2];E.push(j,w,w,S,S,j)}}else if(D!==void 0){let C=D.array;k=D.version;for(let L=0,_=C.length/3-1;L<_;L+=3){let j=L+0,w=L+1,S=L+2;E.push(j,w,w,S,S,j)}}else return;let N=new((p$(E))?g7:b7)(E,1);N.version=k;let F=H.get(q);if(F)Q.remove(F);H.set(q,N)}function G(q){let E=H.get(q);if(E){let O=q.index;if(O!==null){if(E.version<O.version)U(q)}}else U(q);return H.get(q)}return{get:X,update:K,getWireframeAttribute:G}}function uG(J,Q,$){let Z;function W(E){Z=E}let H,Y;function X(E){H=E.type,Y=E.bytesPerElement}function K(E,O){J.drawElements(Z,O,H,E*Y),$.update(O,Z,1)}function U(E,O,D){if(D===0)return;J.drawElementsInstanced(Z,O,H,E*Y,D),$.update(O,Z,D)}function G(E,O,D){if(D===0)return;Q.get("WEBGL_multi_draw").multiDrawElementsWEBGL(Z,O,0,H,E,0,D);let N=0;for(let F=0;F<D;F++)N+=O[F];$.update(N,Z,1)}function q(E,O,D,k){if(D===0)return;let N=Q.get("WEBGL_multi_draw");if(N===null)for(let F=0;F<E.length;F++)U(E[F]/Y,O[F],k[F]);else{N.multiDrawElementsInstancedWEBGL(Z,O,0,H,E,0,k,0,D);let F=0;for(let C=0;C<D;C++)F+=O[C]*k[C];$.update(F,Z,1)}}this.setMode=W,this.setIndex=X,this.render=K,this.renderInstances=U,this.renderMultiDraw=G,this.renderMultiDrawInstances=q}function cG(J){let Q={geometries:0,textures:0},$={frame:0,calls:0,triangles:0,points:0,lines:0};function Z(H,Y,X){switch($.calls++,Y){case J.TRIANGLES:$.triangles+=X*(H/3);break;case J.LINES:$.lines+=X*(H/2);break;case J.LINE_STRIP:$.lines+=X*(H-1);break;case J.LINE_LOOP:$.lines+=X*H;break;case J.POINTS:$.points+=X*H;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",Y);break}}function W(){$.calls=0,$.triangles=0,$.points=0,$.lines=0}return{memory:Q,render:$,programs:null,autoReset:!0,reset:W,update:Z}}function nG(J,Q,$){let Z=new WeakMap,W=new a0;function H(Y,X,K){let U=Y.morphTargetInfluences,G=X.morphAttributes.position||X.morphAttributes.normal||X.morphAttributes.color,q=G!==void 0?G.length:0,E=Z.get(X);if(E===void 0||E.count!==q){let z=function(){S.dispose(),Z.delete(X),X.removeEventListener("dispose",z)};if(E!==void 0)E.texture.dispose();let O=X.morphAttributes.position!==void 0,D=X.morphAttributes.normal!==void 0,k=X.morphAttributes.color!==void 0,N=X.morphAttributes.position||[],F=X.morphAttributes.normal||[],C=X.morphAttributes.color||[],L=0;if(O===!0)L=1;if(D===!0)L=2;if(k===!0)L=3;let _=X.attributes.position.count*L,j=1;if(_>Q.maxTextureSize)j=Math.ceil(_/Q.maxTextureSize),_=Q.maxTextureSize;let w=new Float32Array(_*j*4*q),S=new x7(w,_,j,q);S.type=t8,S.needsUpdate=!0;let p=L*4;for(let V=0;V<q;V++){let A=N[V],m=F[V],c=C[V],l=_*j*4*V;for(let i=0;i<A.count;i++){let u=i*p;if(O===!0)W.fromBufferAttribute(A,i),w[l+u+0]=W.x,w[l+u+1]=W.y,w[l+u+2]=W.z,w[l+u+3]=0;if(D===!0)W.fromBufferAttribute(m,i),w[l+u+4]=W.x,w[l+u+5]=W.y,w[l+u+6]=W.z,w[l+u+7]=0;if(k===!0)W.fromBufferAttribute(c,i),w[l+u+8]=W.x,w[l+u+9]=W.y,w[l+u+10]=W.z,w[l+u+11]=c.itemSize===4?W.w:1}}E={count:q,texture:S,size:new _0(_,j)},Z.set(X,E),X.addEventListener("dispose",z)}if(Y.isInstancedMesh===!0&&Y.morphTexture!==null)K.getUniforms().setValue(J,"morphTexture",Y.morphTexture,$);else{let O=0;for(let k=0;k<U.length;k++)O+=U[k];let D=X.morphTargetsRelative?1:1-O;K.getUniforms().setValue(J,"morphTargetBaseInfluence",D),K.getUniforms().setValue(J,"morphTargetInfluences",U)}K.getUniforms().setValue(J,"morphTargetsTexture",E.texture,$),K.getUniforms().setValue(J,"morphTargetsTextureSize",E.size)}return{update:H}}function sG(J,Q,$,Z){let W=new WeakMap;function H(K){let U=Z.render.frame,G=K.geometry,q=Q.get(K,G);if(W.get(q)!==U)Q.update(q),W.set(q,U);if(K.isInstancedMesh){if(K.hasEventListener("dispose",X)===!1)K.addEventListener("dispose",X);if(W.get(K)!==U){if($.update(K.instanceMatrix,J.ARRAY_BUFFER),K.instanceColor!==null)$.update(K.instanceColor,J.ARRAY_BUFFER);W.set(K,U)}}if(K.isSkinnedMesh){let E=K.skeleton;if(W.get(E)!==U)E.update(),W.set(E,U)}return q}function Y(){W=new WeakMap}function X(K){let U=K.target;if(U.removeEventListener("dispose",X),$.remove(U.instanceMatrix),U.instanceColor!==null)$.remove(U.instanceColor)}return{update:H,dispose:Y}}var sH=new kJ,TH=new a7(1,1),oH=new x7,iH=new m$,aH=new l7,AH=[],SH=[],jH=new Float32Array(16),yH=new Float32Array(9),vH=new Float32Array(4);function U6(J,Q,$){let Z=J[0];if(Z<=0||Z>0)return J;let W=Q*$,H=AH[W];if(H===void 0)H=new Float32Array(W),AH[W]=H;if(Q!==0){Z.toArray(H,0);for(let Y=1,X=0;Y!==Q;++Y)X+=$,J[Y].toArray(H,X)}return H}function LJ(J,Q){if(J.length!==Q.length)return!1;for(let $=0,Z=J.length;$<Z;$++)if(J[$]!==Q[$])return!1;return!0}function VJ(J,Q){for(let $=0,Z=Q.length;$<Z;$++)J[$]=Q[$]}function qQ(J,Q){let $=SH[Q];if($===void 0)$=new Int32Array(Q),SH[Q]=$;for(let Z=0;Z!==Q;++Z)$[Z]=J.allocateTextureUnit();return $}function oG(J,Q){let $=this.cache;if($[0]===Q)return;J.uniform1f(this.addr,Q),$[0]=Q}function iG(J,Q){let $=this.cache;if(Q.x!==void 0){if($[0]!==Q.x||$[1]!==Q.y)J.uniform2f(this.addr,Q.x,Q.y),$[0]=Q.x,$[1]=Q.y}else{if(LJ($,Q))return;J.uniform2fv(this.addr,Q),VJ($,Q)}}function aG(J,Q){let $=this.cache;if(Q.x!==void 0){if($[0]!==Q.x||$[1]!==Q.y||$[2]!==Q.z)J.uniform3f(this.addr,Q.x,Q.y,Q.z),$[0]=Q.x,$[1]=Q.y,$[2]=Q.z}else if(Q.r!==void 0){if($[0]!==Q.r||$[1]!==Q.g||$[2]!==Q.b)J.uniform3f(this.addr,Q.r,Q.g,Q.b),$[0]=Q.r,$[1]=Q.g,$[2]=Q.b}else{if(LJ($,Q))return;J.uniform3fv(this.addr,Q),VJ($,Q)}}function rG(J,Q){let $=this.cache;if(Q.x!==void 0){if($[0]!==Q.x||$[1]!==Q.y||$[2]!==Q.z||$[3]!==Q.w)J.uniform4f(this.addr,Q.x,Q.y,Q.z,Q.w),$[0]=Q.x,$[1]=Q.y,$[2]=Q.z,$[3]=Q.w}else{if(LJ($,Q))return;J.uniform4fv(this.addr,Q),VJ($,Q)}}function tG(J,Q){let $=this.cache,Z=Q.elements;if(Z===void 0){if(LJ($,Q))return;J.uniformMatrix2fv(this.addr,!1,Q),VJ($,Q)}else{if(LJ($,Z))return;vH.set(Z),J.uniformMatrix2fv(this.addr,!1,vH),VJ($,Z)}}function eG(J,Q){let $=this.cache,Z=Q.elements;if(Z===void 0){if(LJ($,Q))return;J.uniformMatrix3fv(this.addr,!1,Q),VJ($,Q)}else{if(LJ($,Z))return;yH.set(Z),J.uniformMatrix3fv(this.addr,!1,yH),VJ($,Z)}}function J1(J,Q){let $=this.cache,Z=Q.elements;if(Z===void 0){if(LJ($,Q))return;J.uniformMatrix4fv(this.addr,!1,Q),VJ($,Q)}else{if(LJ($,Z))return;jH.set(Z),J.uniformMatrix4fv(this.addr,!1,jH),VJ($,Z)}}function Q1(J,Q){let $=this.cache;if($[0]===Q)return;J.uniform1i(this.addr,Q),$[0]=Q}function $1(J,Q){let $=this.cache;if(Q.x!==void 0){if($[0]!==Q.x||$[1]!==Q.y)J.uniform2i(this.addr,Q.x,Q.y),$[0]=Q.x,$[1]=Q.y}else{if(LJ($,Q))return;J.uniform2iv(this.addr,Q),VJ($,Q)}}function Z1(J,Q){let $=this.cache;if(Q.x!==void 0){if($[0]!==Q.x||$[1]!==Q.y||$[2]!==Q.z)J.uniform3i(this.addr,Q.x,Q.y,Q.z),$[0]=Q.x,$[1]=Q.y,$[2]=Q.z}else{if(LJ($,Q))return;J.uniform3iv(this.addr,Q),VJ($,Q)}}function W1(J,Q){let $=this.cache;if(Q.x!==void 0){if($[0]!==Q.x||$[1]!==Q.y||$[2]!==Q.z||$[3]!==Q.w)J.uniform4i(this.addr,Q.x,Q.y,Q.z,Q.w),$[0]=Q.x,$[1]=Q.y,$[2]=Q.z,$[3]=Q.w}else{if(LJ($,Q))return;J.uniform4iv(this.addr,Q),VJ($,Q)}}function H1(J,Q){let $=this.cache;if($[0]===Q)return;J.uniform1ui(this.addr,Q),$[0]=Q}function Y1(J,Q){let $=this.cache;if(Q.x!==void 0){if($[0]!==Q.x||$[1]!==Q.y)J.uniform2ui(this.addr,Q.x,Q.y),$[0]=Q.x,$[1]=Q.y}else{if(LJ($,Q))return;J.uniform2uiv(this.addr,Q),VJ($,Q)}}function X1(J,Q){let $=this.cache;if(Q.x!==void 0){if($[0]!==Q.x||$[1]!==Q.y||$[2]!==Q.z)J.uniform3ui(this.addr,Q.x,Q.y,Q.z),$[0]=Q.x,$[1]=Q.y,$[2]=Q.z}else{if(LJ($,Q))return;J.uniform3uiv(this.addr,Q),VJ($,Q)}}function K1(J,Q){let $=this.cache;if(Q.x!==void 0){if($[0]!==Q.x||$[1]!==Q.y||$[2]!==Q.z||$[3]!==Q.w)J.uniform4ui(this.addr,Q.x,Q.y,Q.z,Q.w),$[0]=Q.x,$[1]=Q.y,$[2]=Q.z,$[3]=Q.w}else{if(LJ($,Q))return;J.uniform4uiv(this.addr,Q),VJ($,Q)}}function U1(J,Q,$){let Z=this.cache,W=$.allocateTextureUnit();if(Z[0]!==W)J.uniform1i(this.addr,W),Z[0]=W;let H;if(this.type===J.SAMPLER_2D_SHADOW)TH.compareFunction=h$,H=TH;else H=sH;$.setTexture2D(Q||H,W)}function G1(J,Q,$){let Z=this.cache,W=$.allocateTextureUnit();if(Z[0]!==W)J.uniform1i(this.addr,W),Z[0]=W;$.setTexture3D(Q||iH,W)}function q1(J,Q,$){let Z=this.cache,W=$.allocateTextureUnit();if(Z[0]!==W)J.uniform1i(this.addr,W),Z[0]=W;$.setTextureCube(Q||aH,W)}function E1(J,Q,$){let Z=this.cache,W=$.allocateTextureUnit();if(Z[0]!==W)J.uniform1i(this.addr,W),Z[0]=W;$.setTexture2DArray(Q||oH,W)}function N1(J){switch(J){case 5126:return oG;case 35664:return iG;case 35665:return aG;case 35666:return rG;case 35674:return tG;case 35675:return eG;case 35676:return J1;case 5124:case 35670:return Q1;case 35667:case 35671:return $1;case 35668:case 35672:return Z1;case 35669:case 35673:return W1;case 5125:return H1;case 36294:return Y1;case 36295:return X1;case 36296:return K1;case 35678:case 36198:case 36298:case 36306:case 35682:return U1;case 35679:case 36299:case 36307:return G1;case 35680:case 36300:case 36308:case 36293:return q1;case 36289:case 36303:case 36311:case 36292:return E1}}function F1(J,Q){J.uniform1fv(this.addr,Q)}function O1(J,Q){let $=U6(Q,this.size,2);J.uniform2fv(this.addr,$)}function R1(J,Q){let $=U6(Q,this.size,3);J.uniform3fv(this.addr,$)}function k1(J,Q){let $=U6(Q,this.size,4);J.uniform4fv(this.addr,$)}function D1(J,Q){let $=U6(Q,this.size,4);J.uniformMatrix2fv(this.addr,!1,$)}function M1(J,Q){let $=U6(Q,this.size,9);J.uniformMatrix3fv(this.addr,!1,$)}function L1(J,Q){let $=U6(Q,this.size,16);J.uniformMatrix4fv(this.addr,!1,$)}function V1(J,Q){J.uniform1iv(this.addr,Q)}function z1(J,Q){J.uniform2iv(this.addr,Q)}function B1(J,Q){J.uniform3iv(this.addr,Q)}function C1(J,Q){J.uniform4iv(this.addr,Q)}function _1(J,Q){J.uniform1uiv(this.addr,Q)}function w1(J,Q){J.uniform2uiv(this.addr,Q)}function I1(J,Q){J.uniform3uiv(this.addr,Q)}function P1(J,Q){J.uniform4uiv(this.addr,Q)}function T1(J,Q,$){let Z=this.cache,W=Q.length,H=qQ($,W);if(!LJ(Z,H))J.uniform1iv(this.addr,H),VJ(Z,H);for(let Y=0;Y!==W;++Y)$.setTexture2D(Q[Y]||sH,H[Y])}function A1(J,Q,$){let Z=this.cache,W=Q.length,H=qQ($,W);if(!LJ(Z,H))J.uniform1iv(this.addr,H),VJ(Z,H);for(let Y=0;Y!==W;++Y)$.setTexture3D(Q[Y]||iH,H[Y])}function S1(J,Q,$){let Z=this.cache,W=Q.length,H=qQ($,W);if(!LJ(Z,H))J.uniform1iv(this.addr,H),VJ(Z,H);for(let Y=0;Y!==W;++Y)$.setTextureCube(Q[Y]||aH,H[Y])}function j1(J,Q,$){let Z=this.cache,W=Q.length,H=qQ($,W);if(!LJ(Z,H))J.uniform1iv(this.addr,H),VJ(Z,H);for(let Y=0;Y!==W;++Y)$.setTexture2DArray(Q[Y]||oH,H[Y])}function y1(J){switch(J){case 5126:return F1;case 35664:return O1;case 35665:return R1;case 35666:return k1;case 35674:return D1;case 35675:return M1;case 35676:return L1;case 5124:case 35670:return V1;case 35667:case 35671:return z1;case 35668:case 35672:return B1;case 35669:case 35673:return C1;case 5125:return _1;case 36294:return w1;case 36295:return I1;case 36296:return P1;case 35678:case 36198:case 36298:case 36306:case 35682:return T1;case 35679:case 36299:case 36307:return A1;case 35680:case 36300:case 36308:case 36293:return S1;case 36289:case 36303:case 36311:case 36292:return j1}}class rH{constructor(J,Q,$){this.id=J,this.addr=$,this.cache=[],this.type=Q.type,this.setValue=N1(Q.type)}}class tH{constructor(J,Q,$){this.id=J,this.addr=$,this.cache=[],this.type=Q.type,this.size=Q.size,this.setValue=y1(Q.type)}}class eH{constructor(J){this.id=J,this.seq=[],this.map={}}setValue(J,Q,$){let Z=this.seq;for(let W=0,H=Z.length;W!==H;++W){let Y=Z[W];Y.setValue(J,Q[Y.id],$)}}}var GZ=/(\w+)(\])?(\[|\.)?/g;function fH(J,Q){J.seq.push(Q),J.map[Q.id]=Q}function v1(J,Q,$){let Z=J.name,W=Z.length;GZ.lastIndex=0;while(!0){let H=GZ.exec(Z),Y=GZ.lastIndex,X=H[1],K=H[2]==="]",U=H[3];if(K)X=X|0;if(U===void 0||U==="["&&Y+2===W){fH($,U===void 0?new rH(X,J,Q):new tH(X,J,Q));break}else{let q=$.map[X];if(q===void 0)q=new eH(X),fH($,q);$=q}}}class l6{constructor(J,Q){this.seq=[],this.map={};let $=J.getProgramParameter(Q,J.ACTIVE_UNIFORMS);for(let Z=0;Z<$;++Z){let W=J.getActiveUniform(Q,Z),H=J.getUniformLocation(Q,W.name);v1(W,H,this)}}setValue(J,Q,$,Z){let W=this.map[Q];if(W!==void 0)W.setValue(J,$,Z)}setOptional(J,Q,$){let Z=Q[$];if(Z!==void 0)this.setValue(J,$,Z)}static upload(J,Q,$,Z){for(let W=0,H=Q.length;W!==H;++W){let Y=Q[W],X=$[Y.id];if(X.needsUpdate!==!1)Y.setValue(J,X.value,Z)}}static seqWithValue(J,Q){let $=[];for(let Z=0,W=J.length;Z!==W;++Z){let H=J[Z];if(H.id in Q)$.push(H)}return $}}function hH(J,Q,$){let Z=J.createShader(Q);return J.shaderSource(Z,$),J.compileShader(Z),Z}var f1=37297,h1=0;function x1(J,Q){let $=J.split(`
`),Z=[],W=Math.max(Q-6,0),H=Math.min(Q+6,$.length);for(let Y=W;Y<H;Y++){let X=Y+1;Z.push(`${X===Q?">":" "} ${X}: ${$[Y]}`)}return Z.join(`
`)}var xH=new f0;function b1(J){n0._getMatrix(xH,n0.workingColorSpace,J);let Q=`mat3( ${xH.elements.map(($)=>$.toFixed(4))} )`;switch(n0.getTransfer(J)){case f$:return[Q,"LinearTransferOETF"];case XJ:return[Q,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",J),[Q,"LinearTransferOETF"]}}function bH(J,Q,$){let Z=J.getShaderParameter(Q,J.COMPILE_STATUS),H=(J.getShaderInfoLog(Q)||"").trim();if(Z&&H==="")return"";let Y=/ERROR: 0:(\d+)/.exec(H);if(Y){let X=parseInt(Y[1]);return $.toUpperCase()+`

`+H+`

`+x1(J.getShaderSource(Q),X)}else return H}function g1(J,Q){let $=b1(Q);return[`vec4 ${J}( vec4 value ) {`,`	return ${$[1]}( vec4( value.rgb * ${$[0]}, value.a ) );`,"}"].join(`
`)}function p1(J,Q){let $;switch(Q){case dW:$="Linear";break;case mW:$="Reinhard";break;case uW:$="Cineon";break;case _7:$="ACESFilmic";break;case nW:$="AgX";break;case sW:$="Neutral";break;case cW:$="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",Q),$="Linear"}return"vec3 "+J+"( vec3 color ) { return "+$+"ToneMapping( color ); }"}var GQ=new P;function l1(){n0.getLuminanceCoefficients(GQ);let J=GQ.x.toFixed(4),Q=GQ.y.toFixed(4),$=GQ.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${J}, ${Q}, ${$} );`,"\treturn dot( weights, rgb );","}"].join(`
`)}function d1(J){return[J.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",J.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(p6).join(`
`)}function m1(J){let Q=[];for(let $ in J){let Z=J[$];if(Z===!1)continue;Q.push("#define "+$+" "+Z)}return Q.join(`
`)}function u1(J,Q){let $={},Z=J.getProgramParameter(Q,J.ACTIVE_ATTRIBUTES);for(let W=0;W<Z;W++){let H=J.getActiveAttrib(Q,W),Y=H.name,X=1;if(H.type===J.FLOAT_MAT2)X=2;if(H.type===J.FLOAT_MAT3)X=3;if(H.type===J.FLOAT_MAT4)X=4;$[Y]={type:H.type,location:J.getAttribLocation(Q,Y),locationSize:X}}return $}function p6(J){return J!==""}function gH(J,Q){let $=Q.numSpotLightShadows+Q.numSpotLightMaps-Q.numSpotLightShadowsWithMaps;return J.replace(/NUM_DIR_LIGHTS/g,Q.numDirLights).replace(/NUM_SPOT_LIGHTS/g,Q.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,Q.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,$).replace(/NUM_RECT_AREA_LIGHTS/g,Q.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,Q.numPointLights).replace(/NUM_HEMI_LIGHTS/g,Q.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,Q.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,Q.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,Q.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,Q.numPointLightShadows)}function pH(J,Q){return J.replace(/NUM_CLIPPING_PLANES/g,Q.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,Q.numClippingPlanes-Q.numClipIntersection)}var c1=/^[ \t]*#include +<([\w\d./]+)>/gm;function EZ(J){return J.replace(c1,s1)}var n1=new Map;function s1(J,Q){let $=p0[Q];if($===void 0){let Z=n1.get(Q);if(Z!==void 0)$=p0[Z],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',Q,Z);else throw Error("Can not resolve #include <"+Q+">")}return EZ($)}var o1=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function lH(J){return J.replace(o1,i1)}function i1(J,Q,$,Z){let W="";for(let H=parseInt(Q);H<parseInt($);H++)W+=Z.replace(/\[\s*i\s*\]/g,"[ "+H+" ]").replace(/UNROLLED_LOOP_INDEX/g,H);return W}function dH(J){let Q=`precision ${J.precision} float;
	precision ${J.precision} int;
	precision ${J.precision} sampler2D;
	precision ${J.precision} samplerCube;
	precision ${J.precision} sampler3D;
	precision ${J.precision} sampler2DArray;
	precision ${J.precision} sampler2DShadow;
	precision ${J.precision} samplerCubeShadow;
	precision ${J.precision} sampler2DArrayShadow;
	precision ${J.precision} isampler2D;
	precision ${J.precision} isampler3D;
	precision ${J.precision} isamplerCube;
	precision ${J.precision} isampler2DArray;
	precision ${J.precision} usampler2D;
	precision ${J.precision} usampler3D;
	precision ${J.precision} usamplerCube;
	precision ${J.precision} usampler2DArray;
	`;if(J.precision==="highp")Q+=`
#define HIGH_PRECISION`;else if(J.precision==="mediump")Q+=`
#define MEDIUM_PRECISION`;else if(J.precision==="lowp")Q+=`
#define LOW_PRECISION`;return Q}function a1(J){let Q="SHADOWMAP_TYPE_BASIC";if(J.shadowMapType===iQ)Q="SHADOWMAP_TYPE_PCF";else if(J.shadowMapType===k7)Q="SHADOWMAP_TYPE_PCF_SOFT";else if(J.shadowMapType===L8)Q="SHADOWMAP_TYPE_VSM";return Q}function r1(J){let Q="ENVMAP_TYPE_CUBE";if(J.envMap)switch(J.envMapMode){case a9:case R9:Q="ENVMAP_TYPE_CUBE";break;case _6:Q="ENVMAP_TYPE_CUBE_UV";break}return Q}function t1(J){let Q="ENVMAP_MODE_REFLECTION";if(J.envMap)switch(J.envMapMode){case R9:Q="ENVMAP_MODE_REFRACTION";break}return Q}function e1(J){let Q="ENVMAP_BLENDING_NONE";if(J.envMap)switch(J.combine){case gW:Q="ENVMAP_BLENDING_MULTIPLY";break;case pW:Q="ENVMAP_BLENDING_MIX";break;case lW:Q="ENVMAP_BLENDING_ADD";break}return Q}function Jq(J){let Q=J.envMapCubeUVHeight;if(Q===null)return null;let $=Math.log2(Q)-2,Z=1/Q;return{texelWidth:1/(3*Math.max(Math.pow(2,$),112)),texelHeight:Z,maxMip:$}}function Qq(J,Q,$,Z){let W=J.getContext(),H=$.defines,Y=$.vertexShader,X=$.fragmentShader,K=a1($),U=r1($),G=t1($),q=e1($),E=Jq($),O=d1($),D=m1(H),k=W.createProgram(),N,F,C=$.glslVersion?"#version "+$.glslVersion+`
`:"";if($.isRawShaderMaterial){if(N=["#define SHADER_TYPE "+$.shaderType,"#define SHADER_NAME "+$.shaderName,D].filter(p6).join(`
`),N.length>0)N+=`
`;if(F=["#define SHADER_TYPE "+$.shaderType,"#define SHADER_NAME "+$.shaderName,D].filter(p6).join(`
`),F.length>0)F+=`
`}else N=[dH($),"#define SHADER_TYPE "+$.shaderType,"#define SHADER_NAME "+$.shaderName,D,$.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",$.batching?"#define USE_BATCHING":"",$.batchingColor?"#define USE_BATCHING_COLOR":"",$.instancing?"#define USE_INSTANCING":"",$.instancingColor?"#define USE_INSTANCING_COLOR":"",$.instancingMorph?"#define USE_INSTANCING_MORPH":"",$.useFog&&$.fog?"#define USE_FOG":"",$.useFog&&$.fogExp2?"#define FOG_EXP2":"",$.map?"#define USE_MAP":"",$.envMap?"#define USE_ENVMAP":"",$.envMap?"#define "+G:"",$.lightMap?"#define USE_LIGHTMAP":"",$.aoMap?"#define USE_AOMAP":"",$.bumpMap?"#define USE_BUMPMAP":"",$.normalMap?"#define USE_NORMALMAP":"",$.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",$.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",$.displacementMap?"#define USE_DISPLACEMENTMAP":"",$.emissiveMap?"#define USE_EMISSIVEMAP":"",$.anisotropy?"#define USE_ANISOTROPY":"",$.anisotropyMap?"#define USE_ANISOTROPYMAP":"",$.clearcoatMap?"#define USE_CLEARCOATMAP":"",$.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",$.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",$.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",$.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",$.specularMap?"#define USE_SPECULARMAP":"",$.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",$.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",$.roughnessMap?"#define USE_ROUGHNESSMAP":"",$.metalnessMap?"#define USE_METALNESSMAP":"",$.alphaMap?"#define USE_ALPHAMAP":"",$.alphaHash?"#define USE_ALPHAHASH":"",$.transmission?"#define USE_TRANSMISSION":"",$.transmissionMap?"#define USE_TRANSMISSIONMAP":"",$.thicknessMap?"#define USE_THICKNESSMAP":"",$.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",$.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",$.mapUv?"#define MAP_UV "+$.mapUv:"",$.alphaMapUv?"#define ALPHAMAP_UV "+$.alphaMapUv:"",$.lightMapUv?"#define LIGHTMAP_UV "+$.lightMapUv:"",$.aoMapUv?"#define AOMAP_UV "+$.aoMapUv:"",$.emissiveMapUv?"#define EMISSIVEMAP_UV "+$.emissiveMapUv:"",$.bumpMapUv?"#define BUMPMAP_UV "+$.bumpMapUv:"",$.normalMapUv?"#define NORMALMAP_UV "+$.normalMapUv:"",$.displacementMapUv?"#define DISPLACEMENTMAP_UV "+$.displacementMapUv:"",$.metalnessMapUv?"#define METALNESSMAP_UV "+$.metalnessMapUv:"",$.roughnessMapUv?"#define ROUGHNESSMAP_UV "+$.roughnessMapUv:"",$.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+$.anisotropyMapUv:"",$.clearcoatMapUv?"#define CLEARCOATMAP_UV "+$.clearcoatMapUv:"",$.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+$.clearcoatNormalMapUv:"",$.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+$.clearcoatRoughnessMapUv:"",$.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+$.iridescenceMapUv:"",$.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+$.iridescenceThicknessMapUv:"",$.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+$.sheenColorMapUv:"",$.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+$.sheenRoughnessMapUv:"",$.specularMapUv?"#define SPECULARMAP_UV "+$.specularMapUv:"",$.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+$.specularColorMapUv:"",$.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+$.specularIntensityMapUv:"",$.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+$.transmissionMapUv:"",$.thicknessMapUv?"#define THICKNESSMAP_UV "+$.thicknessMapUv:"",$.vertexTangents&&$.flatShading===!1?"#define USE_TANGENT":"",$.vertexColors?"#define USE_COLOR":"",$.vertexAlphas?"#define USE_COLOR_ALPHA":"",$.vertexUv1s?"#define USE_UV1":"",$.vertexUv2s?"#define USE_UV2":"",$.vertexUv3s?"#define USE_UV3":"",$.pointsUvs?"#define USE_POINTS_UV":"",$.flatShading?"#define FLAT_SHADED":"",$.skinning?"#define USE_SKINNING":"",$.morphTargets?"#define USE_MORPHTARGETS":"",$.morphNormals&&$.flatShading===!1?"#define USE_MORPHNORMALS":"",$.morphColors?"#define USE_MORPHCOLORS":"",$.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+$.morphTextureStride:"",$.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+$.morphTargetsCount:"",$.doubleSided?"#define DOUBLE_SIDED":"",$.flipSided?"#define FLIP_SIDED":"",$.shadowMapEnabled?"#define USE_SHADOWMAP":"",$.shadowMapEnabled?"#define "+K:"",$.sizeAttenuation?"#define USE_SIZEATTENUATION":"",$.numLightProbes>0?"#define USE_LIGHT_PROBES":"",$.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",$.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","\tattribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","\tattribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","\tuniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","\tattribute vec2 uv1;","#endif","#ifdef USE_UV2","\tattribute vec2 uv2;","#endif","#ifdef USE_UV3","\tattribute vec2 uv3;","#endif","#ifdef USE_TANGENT","\tattribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","\tattribute vec4 color;","#elif defined( USE_COLOR )","\tattribute vec3 color;","#endif","#ifdef USE_SKINNING","\tattribute vec4 skinIndex;","\tattribute vec4 skinWeight;","#endif",`
`].filter(p6).join(`
`),F=[dH($),"#define SHADER_TYPE "+$.shaderType,"#define SHADER_NAME "+$.shaderName,D,$.useFog&&$.fog?"#define USE_FOG":"",$.useFog&&$.fogExp2?"#define FOG_EXP2":"",$.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",$.map?"#define USE_MAP":"",$.matcap?"#define USE_MATCAP":"",$.envMap?"#define USE_ENVMAP":"",$.envMap?"#define "+U:"",$.envMap?"#define "+G:"",$.envMap?"#define "+q:"",E?"#define CUBEUV_TEXEL_WIDTH "+E.texelWidth:"",E?"#define CUBEUV_TEXEL_HEIGHT "+E.texelHeight:"",E?"#define CUBEUV_MAX_MIP "+E.maxMip+".0":"",$.lightMap?"#define USE_LIGHTMAP":"",$.aoMap?"#define USE_AOMAP":"",$.bumpMap?"#define USE_BUMPMAP":"",$.normalMap?"#define USE_NORMALMAP":"",$.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",$.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",$.emissiveMap?"#define USE_EMISSIVEMAP":"",$.anisotropy?"#define USE_ANISOTROPY":"",$.anisotropyMap?"#define USE_ANISOTROPYMAP":"",$.clearcoat?"#define USE_CLEARCOAT":"",$.clearcoatMap?"#define USE_CLEARCOATMAP":"",$.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",$.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",$.dispersion?"#define USE_DISPERSION":"",$.iridescence?"#define USE_IRIDESCENCE":"",$.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",$.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",$.specularMap?"#define USE_SPECULARMAP":"",$.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",$.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",$.roughnessMap?"#define USE_ROUGHNESSMAP":"",$.metalnessMap?"#define USE_METALNESSMAP":"",$.alphaMap?"#define USE_ALPHAMAP":"",$.alphaTest?"#define USE_ALPHATEST":"",$.alphaHash?"#define USE_ALPHAHASH":"",$.sheen?"#define USE_SHEEN":"",$.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",$.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",$.transmission?"#define USE_TRANSMISSION":"",$.transmissionMap?"#define USE_TRANSMISSIONMAP":"",$.thicknessMap?"#define USE_THICKNESSMAP":"",$.vertexTangents&&$.flatShading===!1?"#define USE_TANGENT":"",$.vertexColors||$.instancingColor||$.batchingColor?"#define USE_COLOR":"",$.vertexAlphas?"#define USE_COLOR_ALPHA":"",$.vertexUv1s?"#define USE_UV1":"",$.vertexUv2s?"#define USE_UV2":"",$.vertexUv3s?"#define USE_UV3":"",$.pointsUvs?"#define USE_POINTS_UV":"",$.gradientMap?"#define USE_GRADIENTMAP":"",$.flatShading?"#define FLAT_SHADED":"",$.doubleSided?"#define DOUBLE_SIDED":"",$.flipSided?"#define FLIP_SIDED":"",$.shadowMapEnabled?"#define USE_SHADOWMAP":"",$.shadowMapEnabled?"#define "+K:"",$.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",$.numLightProbes>0?"#define USE_LIGHT_PROBES":"",$.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",$.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",$.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",$.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",$.toneMapping!==v8?"#define TONE_MAPPING":"",$.toneMapping!==v8?p0.tonemapping_pars_fragment:"",$.toneMapping!==v8?p1("toneMapping",$.toneMapping):"",$.dithering?"#define DITHERING":"",$.opaque?"#define OPAQUE":"",p0.colorspace_pars_fragment,g1("linearToOutputTexel",$.outputColorSpace),l1(),$.useDepthPacking?"#define DEPTH_PACKING "+$.depthPacking:"",`
`].filter(p6).join(`
`);if(Y=EZ(Y),Y=gH(Y,$),Y=pH(Y,$),X=EZ(X),X=gH(X,$),X=pH(X,$),Y=lH(Y),X=lH(X),$.isRawShaderMaterial!==!0)C=`#version 300 es
`,N=[O,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+N,F=["#define varying in",$.glslVersion===x$?"":"layout(location = 0) out highp vec4 pc_fragColor;",$.glslVersion===x$?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+F;let L=C+N+Y,_=C+F+X,j=hH(W,W.VERTEX_SHADER,L),w=hH(W,W.FRAGMENT_SHADER,_);if(W.attachShader(k,j),W.attachShader(k,w),$.index0AttributeName!==void 0)W.bindAttribLocation(k,0,$.index0AttributeName);else if($.morphTargets===!0)W.bindAttribLocation(k,0,"position");W.linkProgram(k);function S(A){if(J.debug.checkShaderErrors){let m=W.getProgramInfoLog(k)||"",c=W.getShaderInfoLog(j)||"",l=W.getShaderInfoLog(w)||"",i=m.trim(),u=c.trim(),r=l.trim(),b=!0,X0=!0;if(W.getProgramParameter(k,W.LINK_STATUS)===!1)if(b=!1,typeof J.debug.onShaderError==="function")J.debug.onShaderError(W,k,j,w);else{let g=bH(W,j,"vertex"),$0=bH(W,w,"fragment");console.error("THREE.WebGLProgram: Shader Error "+W.getError()+" - VALIDATE_STATUS "+W.getProgramParameter(k,W.VALIDATE_STATUS)+`

Material Name: `+A.name+`
Material Type: `+A.type+`

Program Info Log: `+i+`
`+g+`
`+$0)}else if(i!=="")console.warn("THREE.WebGLProgram: Program Info Log:",i);else if(u===""||r==="")X0=!1;if(X0)A.diagnostics={runnable:b,programLog:i,vertexShader:{log:u,prefix:N},fragmentShader:{log:r,prefix:F}}}W.deleteShader(j),W.deleteShader(w),p=new l6(W,k),z=u1(W,k)}let p;this.getUniforms=function(){if(p===void 0)S(this);return p};let z;this.getAttributes=function(){if(z===void 0)S(this);return z};let V=$.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){if(V===!1)V=W.getProgramParameter(k,f1);return V},this.destroy=function(){Z.releaseStatesOfProgram(this),W.deleteProgram(k),this.program=void 0},this.type=$.shaderType,this.name=$.shaderName,this.id=h1++,this.cacheKey=Q,this.usedTimes=1,this.program=k,this.vertexShader=j,this.fragmentShader=w,this}var $q=0;class JY{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(J){let{vertexShader:Q,fragmentShader:$}=J,Z=this._getShaderStage(Q),W=this._getShaderStage($),H=this._getShaderCacheForMaterial(J);if(H.has(Z)===!1)H.add(Z),Z.usedTimes++;if(H.has(W)===!1)H.add(W),W.usedTimes++;return this}remove(J){let Q=this.materialCache.get(J);for(let $ of Q)if($.usedTimes--,$.usedTimes===0)this.shaderCache.delete($.code);return this.materialCache.delete(J),this}getVertexShaderID(J){return this._getShaderStage(J.vertexShader).id}getFragmentShaderID(J){return this._getShaderStage(J.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(J){let Q=this.materialCache,$=Q.get(J);if($===void 0)$=new Set,Q.set(J,$);return $}_getShaderStage(J){let Q=this.shaderCache,$=Q.get(J);if($===void 0)$=new QY(J),Q.set(J,$);return $}}class QY{constructor(J){this.id=$q++,this.code=J,this.usedTimes=0}}function Zq(J,Q,$,Z,W,H,Y){let X=new S6,K=new JY,U=new Set,G=[],q=W.logarithmicDepthBuffer,E=W.vertexTextures,O=W.precision,D={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function k(z){if(U.add(z),z===0)return"uv";return`uv${z}`}function N(z,V,A,m,c){let l=m.fog,i=c.geometry,u=z.isMeshStandardMaterial?m.environment:null,r=(z.isMeshStandardMaterial?$:Q).get(z.envMap||u),b=!!r&&r.mapping===_6?r.image.height:null,X0=D[z.type];if(z.precision!==null){if(O=W.getMaxPrecision(z.precision),O!==z.precision)console.warn("THREE.WebGLProgram.getParameters:",z.precision,"not supported, using",O,"instead.")}let g=i.morphAttributes.position||i.morphAttributes.normal||i.morphAttributes.color,$0=g!==void 0?g.length:0,w0=0;if(i.morphAttributes.position!==void 0)w0=1;if(i.morphAttributes.normal!==void 0)w0=2;if(i.morphAttributes.color!==void 0)w0=3;let u0,s0,n,W0;if(X0){let JJ=B8[X0];u0=JJ.vertexShader,s0=JJ.fragmentShader}else u0=z.vertexShader,s0=z.fragmentShader,K.update(z),n=K.getVertexShaderID(z),W0=K.getFragmentShaderID(z);let Q0=J.getRenderTarget(),M0=J.state.buffers.depth.getReversed(),S0=c.isInstancedMesh===!0,T0=c.isBatchedMesh===!0,GJ=!!z.map,I=!!z.matcap,ZJ=!!r,x0=!!z.aoMap,h0=!!z.lightMap,k0=!!z.bumpMap,qJ=!!z.normalMap,z0=!!z.displacementMap,I0=!!z.emissiveMap,PJ=!!z.metalnessMap,CJ=!!z.roughnessMap,RJ=z.anisotropy>0,B=z.clearcoat>0,R=z.dispersion>0,f=z.iridescence>0,s=z.sheen>0,a=z.transmission>0,d=RJ&&!!z.anisotropyMap,N0=B&&!!z.clearcoatMap,Z0=B&&!!z.clearcoatNormalMap,D0=B&&!!z.clearcoatRoughnessMap,y0=f&&!!z.iridescenceMap,J0=f&&!!z.iridescenceThicknessMap,G0=s&&!!z.sheenColorMap,L0=s&&!!z.sheenRoughnessMap,V0=!!z.specularMap,q0=!!z.specularColorMap,l0=!!z.specularIntensityMap,T=a&&!!z.transmissionMap,K0=a&&!!z.thicknessMap,H0=!!z.gradientMap,F0=!!z.alphaMap,t=z.alphaTest>0,o=!!z.alphaHash,R0=!!z.extensions,b0=v8;if(z.toneMapped){if(Q0===null||Q0.isXRRenderTarget===!0)b0=J.toneMapping}let WJ={shaderID:X0,shaderType:z.type,shaderName:z.name,vertexShader:u0,fragmentShader:s0,defines:z.defines,customVertexShaderID:n,customFragmentShaderID:W0,isRawShaderMaterial:z.isRawShaderMaterial===!0,glslVersion:z.glslVersion,precision:O,batching:T0,batchingColor:T0&&c._colorsTexture!==null,instancing:S0,instancingColor:S0&&c.instanceColor!==null,instancingMorph:S0&&c.morphTexture!==null,supportsVertexTextures:E,outputColorSpace:Q0===null?J.outputColorSpace:Q0.isXRRenderTarget===!0?Q0.texture.colorSpace:hJ,alphaToCoverage:!!z.alphaToCoverage,map:GJ,matcap:I,envMap:ZJ,envMapMode:ZJ&&r.mapping,envMapCubeUVHeight:b,aoMap:x0,lightMap:h0,bumpMap:k0,normalMap:qJ,displacementMap:E&&z0,emissiveMap:I0,normalMapObjectSpace:qJ&&z.normalMapType===WH,normalMapTangentSpace:qJ&&z.normalMapType===ZH,metalnessMap:PJ,roughnessMap:CJ,anisotropy:RJ,anisotropyMap:d,clearcoat:B,clearcoatMap:N0,clearcoatNormalMap:Z0,clearcoatRoughnessMap:D0,dispersion:R,iridescence:f,iridescenceMap:y0,iridescenceThicknessMap:J0,sheen:s,sheenColorMap:G0,sheenRoughnessMap:L0,specularMap:V0,specularColorMap:q0,specularIntensityMap:l0,transmission:a,transmissionMap:T,thicknessMap:K0,gradientMap:H0,opaque:z.transparent===!1&&z.blending===B6&&z.alphaToCoverage===!1,alphaMap:F0,alphaTest:t,alphaHash:o,combine:z.combine,mapUv:GJ&&k(z.map.channel),aoMapUv:x0&&k(z.aoMap.channel),lightMapUv:h0&&k(z.lightMap.channel),bumpMapUv:k0&&k(z.bumpMap.channel),normalMapUv:qJ&&k(z.normalMap.channel),displacementMapUv:z0&&k(z.displacementMap.channel),emissiveMapUv:I0&&k(z.emissiveMap.channel),metalnessMapUv:PJ&&k(z.metalnessMap.channel),roughnessMapUv:CJ&&k(z.roughnessMap.channel),anisotropyMapUv:d&&k(z.anisotropyMap.channel),clearcoatMapUv:N0&&k(z.clearcoatMap.channel),clearcoatNormalMapUv:Z0&&k(z.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:D0&&k(z.clearcoatRoughnessMap.channel),iridescenceMapUv:y0&&k(z.iridescenceMap.channel),iridescenceThicknessMapUv:J0&&k(z.iridescenceThicknessMap.channel),sheenColorMapUv:G0&&k(z.sheenColorMap.channel),sheenRoughnessMapUv:L0&&k(z.sheenRoughnessMap.channel),specularMapUv:V0&&k(z.specularMap.channel),specularColorMapUv:q0&&k(z.specularColorMap.channel),specularIntensityMapUv:l0&&k(z.specularIntensityMap.channel),transmissionMapUv:T&&k(z.transmissionMap.channel),thicknessMapUv:K0&&k(z.thicknessMap.channel),alphaMapUv:F0&&k(z.alphaMap.channel),vertexTangents:!!i.attributes.tangent&&(qJ||RJ),vertexColors:z.vertexColors,vertexAlphas:z.vertexColors===!0&&!!i.attributes.color&&i.attributes.color.itemSize===4,pointsUvs:c.isPoints===!0&&!!i.attributes.uv&&(GJ||F0),fog:!!l,useFog:z.fog===!0,fogExp2:!!l&&l.isFogExp2,flatShading:z.flatShading===!0&&z.wireframe===!1,sizeAttenuation:z.sizeAttenuation===!0,logarithmicDepthBuffer:q,reversedDepthBuffer:M0,skinning:c.isSkinnedMesh===!0,morphTargets:i.morphAttributes.position!==void 0,morphNormals:i.morphAttributes.normal!==void 0,morphColors:i.morphAttributes.color!==void 0,morphTargetsCount:$0,morphTextureStride:w0,numDirLights:V.directional.length,numPointLights:V.point.length,numSpotLights:V.spot.length,numSpotLightMaps:V.spotLightMap.length,numRectAreaLights:V.rectArea.length,numHemiLights:V.hemi.length,numDirLightShadows:V.directionalShadowMap.length,numPointLightShadows:V.pointShadowMap.length,numSpotLightShadows:V.spotShadowMap.length,numSpotLightShadowsWithMaps:V.numSpotLightShadowsWithMaps,numLightProbes:V.numLightProbes,numClippingPlanes:Y.numPlanes,numClipIntersection:Y.numIntersection,dithering:z.dithering,shadowMapEnabled:J.shadowMap.enabled&&A.length>0,shadowMapType:J.shadowMap.type,toneMapping:b0,decodeVideoTexture:GJ&&z.map.isVideoTexture===!0&&n0.getTransfer(z.map.colorSpace)===XJ,decodeVideoTextureEmissive:I0&&z.emissiveMap.isVideoTexture===!0&&n0.getTransfer(z.emissiveMap.colorSpace)===XJ,premultipliedAlpha:z.premultipliedAlpha,doubleSided:z.side===$8,flipSided:z.side===uJ,useDepthPacking:z.depthPacking>=0,depthPacking:z.depthPacking||0,index0AttributeName:z.index0AttributeName,extensionClipCullDistance:R0&&z.extensions.clipCullDistance===!0&&Z.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(R0&&z.extensions.multiDraw===!0||T0)&&Z.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:Z.has("KHR_parallel_shader_compile"),customProgramCacheKey:z.customProgramCacheKey()};return WJ.vertexUv1s=U.has(1),WJ.vertexUv2s=U.has(2),WJ.vertexUv3s=U.has(3),U.clear(),WJ}function F(z){let V=[];if(z.shaderID)V.push(z.shaderID);else V.push(z.customVertexShaderID),V.push(z.customFragmentShaderID);if(z.defines!==void 0)for(let A in z.defines)V.push(A),V.push(z.defines[A]);if(z.isRawShaderMaterial===!1)C(V,z),L(V,z),V.push(J.outputColorSpace);return V.push(z.customProgramCacheKey),V.join()}function C(z,V){z.push(V.precision),z.push(V.outputColorSpace),z.push(V.envMapMode),z.push(V.envMapCubeUVHeight),z.push(V.mapUv),z.push(V.alphaMapUv),z.push(V.lightMapUv),z.push(V.aoMapUv),z.push(V.bumpMapUv),z.push(V.normalMapUv),z.push(V.displacementMapUv),z.push(V.emissiveMapUv),z.push(V.metalnessMapUv),z.push(V.roughnessMapUv),z.push(V.anisotropyMapUv),z.push(V.clearcoatMapUv),z.push(V.clearcoatNormalMapUv),z.push(V.clearcoatRoughnessMapUv),z.push(V.iridescenceMapUv),z.push(V.iridescenceThicknessMapUv),z.push(V.sheenColorMapUv),z.push(V.sheenRoughnessMapUv),z.push(V.specularMapUv),z.push(V.specularColorMapUv),z.push(V.specularIntensityMapUv),z.push(V.transmissionMapUv),z.push(V.thicknessMapUv),z.push(V.combine),z.push(V.fogExp2),z.push(V.sizeAttenuation),z.push(V.morphTargetsCount),z.push(V.morphAttributeCount),z.push(V.numDirLights),z.push(V.numPointLights),z.push(V.numSpotLights),z.push(V.numSpotLightMaps),z.push(V.numHemiLights),z.push(V.numRectAreaLights),z.push(V.numDirLightShadows),z.push(V.numPointLightShadows),z.push(V.numSpotLightShadows),z.push(V.numSpotLightShadowsWithMaps),z.push(V.numLightProbes),z.push(V.shadowMapType),z.push(V.toneMapping),z.push(V.numClippingPlanes),z.push(V.numClipIntersection),z.push(V.depthPacking)}function L(z,V){if(X.disableAll(),V.supportsVertexTextures)X.enable(0);if(V.instancing)X.enable(1);if(V.instancingColor)X.enable(2);if(V.instancingMorph)X.enable(3);if(V.matcap)X.enable(4);if(V.envMap)X.enable(5);if(V.normalMapObjectSpace)X.enable(6);if(V.normalMapTangentSpace)X.enable(7);if(V.clearcoat)X.enable(8);if(V.iridescence)X.enable(9);if(V.alphaTest)X.enable(10);if(V.vertexColors)X.enable(11);if(V.vertexAlphas)X.enable(12);if(V.vertexUv1s)X.enable(13);if(V.vertexUv2s)X.enable(14);if(V.vertexUv3s)X.enable(15);if(V.vertexTangents)X.enable(16);if(V.anisotropy)X.enable(17);if(V.alphaHash)X.enable(18);if(V.batching)X.enable(19);if(V.dispersion)X.enable(20);if(V.batchingColor)X.enable(21);if(V.gradientMap)X.enable(22);if(z.push(X.mask),X.disableAll(),V.fog)X.enable(0);if(V.useFog)X.enable(1);if(V.flatShading)X.enable(2);if(V.logarithmicDepthBuffer)X.enable(3);if(V.reversedDepthBuffer)X.enable(4);if(V.skinning)X.enable(5);if(V.morphTargets)X.enable(6);if(V.morphNormals)X.enable(7);if(V.morphColors)X.enable(8);if(V.premultipliedAlpha)X.enable(9);if(V.shadowMapEnabled)X.enable(10);if(V.doubleSided)X.enable(11);if(V.flipSided)X.enable(12);if(V.useDepthPacking)X.enable(13);if(V.dithering)X.enable(14);if(V.transmission)X.enable(15);if(V.sheen)X.enable(16);if(V.opaque)X.enable(17);if(V.pointsUvs)X.enable(18);if(V.decodeVideoTexture)X.enable(19);if(V.decodeVideoTextureEmissive)X.enable(20);if(V.alphaToCoverage)X.enable(21);z.push(X.mask)}function _(z){let V=D[z.type],A;if(V){let m=B8[V];A=OH.clone(m.uniforms)}else A=z.uniforms;return A}function j(z,V){let A;for(let m=0,c=G.length;m<c;m++){let l=G[m];if(l.cacheKey===V){A=l,++A.usedTimes;break}}if(A===void 0)A=new Qq(J,V,z,H),G.push(A);return A}function w(z){if(--z.usedTimes===0){let V=G.indexOf(z);G[V]=G[G.length-1],G.pop(),z.destroy()}}function S(z){K.remove(z)}function p(){K.dispose()}return{getParameters:N,getProgramCacheKey:F,getUniforms:_,acquireProgram:j,releaseProgram:w,releaseShaderCache:S,programs:G,dispose:p}}function Wq(){let J=new WeakMap;function Q(Y){return J.has(Y)}function $(Y){let X=J.get(Y);if(X===void 0)X={},J.set(Y,X);return X}function Z(Y){J.delete(Y)}function W(Y,X,K){J.get(Y)[X]=K}function H(){J=new WeakMap}return{has:Q,get:$,remove:Z,update:W,dispose:H}}function Hq(J,Q){if(J.groupOrder!==Q.groupOrder)return J.groupOrder-Q.groupOrder;else if(J.renderOrder!==Q.renderOrder)return J.renderOrder-Q.renderOrder;else if(J.material.id!==Q.material.id)return J.material.id-Q.material.id;else if(J.z!==Q.z)return J.z-Q.z;else return J.id-Q.id}function mH(J,Q){if(J.groupOrder!==Q.groupOrder)return J.groupOrder-Q.groupOrder;else if(J.renderOrder!==Q.renderOrder)return J.renderOrder-Q.renderOrder;else if(J.z!==Q.z)return Q.z-J.z;else return J.id-Q.id}function uH(){let J=[],Q=0,$=[],Z=[],W=[];function H(){Q=0,$.length=0,Z.length=0,W.length=0}function Y(q,E,O,D,k,N){let F=J[Q];if(F===void 0)F={id:q.id,object:q,geometry:E,material:O,groupOrder:D,renderOrder:q.renderOrder,z:k,group:N},J[Q]=F;else F.id=q.id,F.object=q,F.geometry=E,F.material=O,F.groupOrder=D,F.renderOrder=q.renderOrder,F.z=k,F.group=N;return Q++,F}function X(q,E,O,D,k,N){let F=Y(q,E,O,D,k,N);if(O.transmission>0)Z.push(F);else if(O.transparent===!0)W.push(F);else $.push(F)}function K(q,E,O,D,k,N){let F=Y(q,E,O,D,k,N);if(O.transmission>0)Z.unshift(F);else if(O.transparent===!0)W.unshift(F);else $.unshift(F)}function U(q,E){if($.length>1)$.sort(q||Hq);if(Z.length>1)Z.sort(E||mH);if(W.length>1)W.sort(E||mH)}function G(){for(let q=Q,E=J.length;q<E;q++){let O=J[q];if(O.id===null)break;O.id=null,O.object=null,O.geometry=null,O.material=null,O.group=null}}return{opaque:$,transmissive:Z,transparent:W,init:H,push:X,unshift:K,finish:G,sort:U}}function Yq(){let J=new WeakMap;function Q(Z,W){let H=J.get(Z),Y;if(H===void 0)Y=new uH,J.set(Z,[Y]);else if(W>=H.length)Y=new uH,H.push(Y);else Y=H[W];return Y}function $(){J=new WeakMap}return{get:Q,dispose:$}}function Xq(){let J={};return{get:function(Q){if(J[Q.id]!==void 0)return J[Q.id];let $;switch(Q.type){case"DirectionalLight":$={direction:new P,color:new P0};break;case"SpotLight":$={position:new P,direction:new P,color:new P0,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":$={position:new P,color:new P0,distance:0,decay:0};break;case"HemisphereLight":$={direction:new P,skyColor:new P0,groundColor:new P0};break;case"RectAreaLight":$={color:new P0,position:new P,halfWidth:new P,halfHeight:new P};break}return J[Q.id]=$,$}}}function Kq(){let J={};return{get:function(Q){if(J[Q.id]!==void 0)return J[Q.id];let $;switch(Q.type){case"DirectionalLight":$={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new _0};break;case"SpotLight":$={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new _0};break;case"PointLight":$={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new _0,shadowCameraNear:1,shadowCameraFar:1000};break}return J[Q.id]=$,$}}}var Uq=0;function Gq(J,Q){return(Q.castShadow?2:0)-(J.castShadow?2:0)+(Q.map?1:0)-(J.map?1:0)}function qq(J){let Q=new Xq,$=Kq(),Z={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let U=0;U<9;U++)Z.probe.push(new P);let W=new P,H=new j0,Y=new j0;function X(U){let G=0,q=0,E=0;for(let z=0;z<9;z++)Z.probe[z].set(0,0,0);let O=0,D=0,k=0,N=0,F=0,C=0,L=0,_=0,j=0,w=0,S=0;U.sort(Gq);for(let z=0,V=U.length;z<V;z++){let A=U[z],m=A.color,c=A.intensity,l=A.distance,i=A.shadow&&A.shadow.map?A.shadow.map.texture:null;if(A.isAmbientLight)G+=m.r*c,q+=m.g*c,E+=m.b*c;else if(A.isLightProbe){for(let u=0;u<9;u++)Z.probe[u].addScaledVector(A.sh.coefficients[u],c);S++}else if(A.isDirectionalLight){let u=Q.get(A);if(u.color.copy(A.color).multiplyScalar(A.intensity),A.castShadow){let r=A.shadow,b=$.get(A);b.shadowIntensity=r.intensity,b.shadowBias=r.bias,b.shadowNormalBias=r.normalBias,b.shadowRadius=r.radius,b.shadowMapSize=r.mapSize,Z.directionalShadow[O]=b,Z.directionalShadowMap[O]=i,Z.directionalShadowMatrix[O]=A.shadow.matrix,C++}Z.directional[O]=u,O++}else if(A.isSpotLight){let u=Q.get(A);u.position.setFromMatrixPosition(A.matrixWorld),u.color.copy(m).multiplyScalar(c),u.distance=l,u.coneCos=Math.cos(A.angle),u.penumbraCos=Math.cos(A.angle*(1-A.penumbra)),u.decay=A.decay,Z.spot[k]=u;let r=A.shadow;if(A.map){if(Z.spotLightMap[j]=A.map,j++,r.updateMatrices(A),A.castShadow)w++}if(Z.spotLightMatrix[k]=r.matrix,A.castShadow){let b=$.get(A);b.shadowIntensity=r.intensity,b.shadowBias=r.bias,b.shadowNormalBias=r.normalBias,b.shadowRadius=r.radius,b.shadowMapSize=r.mapSize,Z.spotShadow[k]=b,Z.spotShadowMap[k]=i,_++}k++}else if(A.isRectAreaLight){let u=Q.get(A);u.color.copy(m).multiplyScalar(c),u.halfWidth.set(A.width*0.5,0,0),u.halfHeight.set(0,A.height*0.5,0),Z.rectArea[N]=u,N++}else if(A.isPointLight){let u=Q.get(A);if(u.color.copy(A.color).multiplyScalar(A.intensity),u.distance=A.distance,u.decay=A.decay,A.castShadow){let r=A.shadow,b=$.get(A);b.shadowIntensity=r.intensity,b.shadowBias=r.bias,b.shadowNormalBias=r.normalBias,b.shadowRadius=r.radius,b.shadowMapSize=r.mapSize,b.shadowCameraNear=r.camera.near,b.shadowCameraFar=r.camera.far,Z.pointShadow[D]=b,Z.pointShadowMap[D]=i,Z.pointShadowMatrix[D]=A.shadow.matrix,L++}Z.point[D]=u,D++}else if(A.isHemisphereLight){let u=Q.get(A);u.skyColor.copy(A.color).multiplyScalar(c),u.groundColor.copy(A.groundColor).multiplyScalar(c),Z.hemi[F]=u,F++}}if(N>0)if(J.has("OES_texture_float_linear")===!0)Z.rectAreaLTC1=Y0.LTC_FLOAT_1,Z.rectAreaLTC2=Y0.LTC_FLOAT_2;else Z.rectAreaLTC1=Y0.LTC_HALF_1,Z.rectAreaLTC2=Y0.LTC_HALF_2;Z.ambient[0]=G,Z.ambient[1]=q,Z.ambient[2]=E;let p=Z.hash;if(p.directionalLength!==O||p.pointLength!==D||p.spotLength!==k||p.rectAreaLength!==N||p.hemiLength!==F||p.numDirectionalShadows!==C||p.numPointShadows!==L||p.numSpotShadows!==_||p.numSpotMaps!==j||p.numLightProbes!==S)Z.directional.length=O,Z.spot.length=k,Z.rectArea.length=N,Z.point.length=D,Z.hemi.length=F,Z.directionalShadow.length=C,Z.directionalShadowMap.length=C,Z.pointShadow.length=L,Z.pointShadowMap.length=L,Z.spotShadow.length=_,Z.spotShadowMap.length=_,Z.directionalShadowMatrix.length=C,Z.pointShadowMatrix.length=L,Z.spotLightMatrix.length=_+j-w,Z.spotLightMap.length=j,Z.numSpotLightShadowsWithMaps=w,Z.numLightProbes=S,p.directionalLength=O,p.pointLength=D,p.spotLength=k,p.rectAreaLength=N,p.hemiLength=F,p.numDirectionalShadows=C,p.numPointShadows=L,p.numSpotShadows=_,p.numSpotMaps=j,p.numLightProbes=S,Z.version=Uq++}function K(U,G){let q=0,E=0,O=0,D=0,k=0,N=G.matrixWorldInverse;for(let F=0,C=U.length;F<C;F++){let L=U[F];if(L.isDirectionalLight){let _=Z.directional[q];_.direction.setFromMatrixPosition(L.matrixWorld),W.setFromMatrixPosition(L.target.matrixWorld),_.direction.sub(W),_.direction.transformDirection(N),q++}else if(L.isSpotLight){let _=Z.spot[O];_.position.setFromMatrixPosition(L.matrixWorld),_.position.applyMatrix4(N),_.direction.setFromMatrixPosition(L.matrixWorld),W.setFromMatrixPosition(L.target.matrixWorld),_.direction.sub(W),_.direction.transformDirection(N),O++}else if(L.isRectAreaLight){let _=Z.rectArea[D];_.position.setFromMatrixPosition(L.matrixWorld),_.position.applyMatrix4(N),Y.identity(),H.copy(L.matrixWorld),H.premultiply(N),Y.extractRotation(H),_.halfWidth.set(L.width*0.5,0,0),_.halfHeight.set(0,L.height*0.5,0),_.halfWidth.applyMatrix4(Y),_.halfHeight.applyMatrix4(Y),D++}else if(L.isPointLight){let _=Z.point[E];_.position.setFromMatrixPosition(L.matrixWorld),_.position.applyMatrix4(N),E++}else if(L.isHemisphereLight){let _=Z.hemi[k];_.direction.setFromMatrixPosition(L.matrixWorld),_.direction.transformDirection(N),k++}}}return{setup:X,setupView:K,state:Z}}function cH(J){let Q=new qq(J),$=[],Z=[];function W(G){U.camera=G,$.length=0,Z.length=0}function H(G){$.push(G)}function Y(G){Z.push(G)}function X(){Q.setup($)}function K(G){Q.setupView($,G)}let U={lightsArray:$,shadowsArray:Z,camera:null,lights:Q,transmissionRenderTarget:{}};return{init:W,state:U,setupLights:X,setupLightsView:K,pushLight:H,pushShadow:Y}}function Eq(J){let Q=new WeakMap;function $(W,H=0){let Y=Q.get(W),X;if(Y===void 0)X=new cH(J),Q.set(W,[X]);else if(H>=Y.length)X=new cH(J),Y.push(X);else X=Y[H];return X}function Z(){Q=new WeakMap}return{get:$,dispose:Z}}var Nq=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Fq=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function Oq(J,Q,$){let Z=new h6,W=new _0,H=new _0,Y=new a0,X=new s$({depthPacking:$H}),K=new o$,U={},G=$.maxTextureSize,q={[i8]:uJ,[uJ]:i8,[$8]:$8},E=new z8({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new _0},radius:{value:4}},vertexShader:Nq,fragmentShader:Fq}),O=E.clone();O.defines.HORIZONTAL_PASS=1;let D=new oJ;D.setAttribute("position",new MJ(new Float32Array([-1,-1,0.5,3,-1,0.5,-1,3,0.5]),3));let k=new IJ(D,E),N=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=iQ;let F=this.type;this.render=function(w,S,p){if(N.enabled===!1)return;if(N.autoUpdate===!1&&N.needsUpdate===!1)return;if(w.length===0)return;let z=J.getRenderTarget(),V=J.getActiveCubeFace(),A=J.getActiveMipmapLevel(),m=J.state;if(m.setBlending(a8),m.buffers.depth.getReversed()===!0)m.buffers.color.setClear(0,0,0,0);else m.buffers.color.setClear(1,1,1,1);m.buffers.depth.setTest(!0),m.setScissorTest(!1);let c=F!==L8&&this.type===L8,l=F===L8&&this.type!==L8;for(let i=0,u=w.length;i<u;i++){let r=w[i],b=r.shadow;if(b===void 0){console.warn("THREE.WebGLShadowMap:",r,"has no shadow.");continue}if(b.autoUpdate===!1&&b.needsUpdate===!1)continue;W.copy(b.mapSize);let X0=b.getFrameExtents();if(W.multiply(X0),H.copy(b.mapSize),W.x>G||W.y>G){if(W.x>G)H.x=Math.floor(G/X0.x),W.x=H.x*X0.x,b.mapSize.x=H.x;if(W.y>G)H.y=Math.floor(G/X0.y),W.y=H.y*X0.y,b.mapSize.y=H.y}if(b.map===null||c===!0||l===!0){let $0=this.type!==L8?{minFilter:f8,magFilter:f8}:{};if(b.map!==null)b.map.dispose();b.map=new b8(W.x,W.y,$0),b.map.texture.name=r.name+".shadowMap",b.camera.updateProjectionMatrix()}J.setRenderTarget(b.map),J.clear();let g=b.getViewportCount();for(let $0=0;$0<g;$0++){let w0=b.getViewport($0);Y.set(H.x*w0.x,H.y*w0.y,H.x*w0.z,H.y*w0.w),m.viewport(Y),b.updateMatrices(r,$0),Z=b.getFrustum(),_(S,p,b.camera,r,this.type)}if(b.isPointLightShadow!==!0&&this.type===L8)C(b,p);b.needsUpdate=!1}F=this.type,N.needsUpdate=!1,J.setRenderTarget(z,V,A)};function C(w,S){let p=Q.update(k);if(E.defines.VSM_SAMPLES!==w.blurSamples)E.defines.VSM_SAMPLES=w.blurSamples,O.defines.VSM_SAMPLES=w.blurSamples,E.needsUpdate=!0,O.needsUpdate=!0;if(w.mapPass===null)w.mapPass=new b8(W.x,W.y);E.uniforms.shadow_pass.value=w.map.texture,E.uniforms.resolution.value=w.mapSize,E.uniforms.radius.value=w.radius,J.setRenderTarget(w.mapPass),J.clear(),J.renderBufferDirect(S,null,p,E,k,null),O.uniforms.shadow_pass.value=w.mapPass.texture,O.uniforms.resolution.value=w.mapSize,O.uniforms.radius.value=w.radius,J.setRenderTarget(w.map),J.clear(),J.renderBufferDirect(S,null,p,O,k,null)}function L(w,S,p,z){let V=null,A=p.isPointLight===!0?w.customDistanceMaterial:w.customDepthMaterial;if(A!==void 0)V=A;else if(V=p.isPointLight===!0?K:X,J.localClippingEnabled&&S.clipShadows===!0&&Array.isArray(S.clippingPlanes)&&S.clippingPlanes.length!==0||S.displacementMap&&S.displacementScale!==0||S.alphaMap&&S.alphaTest>0||S.map&&S.alphaTest>0||S.alphaToCoverage===!0){let m=V.uuid,c=S.uuid,l=U[m];if(l===void 0)l={},U[m]=l;let i=l[c];if(i===void 0)i=V.clone(),l[c]=i,S.addEventListener("dispose",j);V=i}if(V.visible=S.visible,V.wireframe=S.wireframe,z===L8)V.side=S.shadowSide!==null?S.shadowSide:S.side;else V.side=S.shadowSide!==null?S.shadowSide:q[S.side];if(V.alphaMap=S.alphaMap,V.alphaTest=S.alphaToCoverage===!0?0.5:S.alphaTest,V.map=S.map,V.clipShadows=S.clipShadows,V.clippingPlanes=S.clippingPlanes,V.clipIntersection=S.clipIntersection,V.displacementMap=S.displacementMap,V.displacementScale=S.displacementScale,V.displacementBias=S.displacementBias,V.wireframeLinewidth=S.wireframeLinewidth,V.linewidth=S.linewidth,p.isPointLight===!0&&V.isMeshDistanceMaterial===!0){let m=J.properties.get(V);m.light=p}return V}function _(w,S,p,z,V){if(w.visible===!1)return;if(w.layers.test(S.layers)&&(w.isMesh||w.isLine||w.isPoints)){if((w.castShadow||w.receiveShadow&&V===L8)&&(!w.frustumCulled||Z.intersectsObject(w))){w.modelViewMatrix.multiplyMatrices(p.matrixWorldInverse,w.matrixWorld);let c=Q.update(w),l=w.material;if(Array.isArray(l)){let i=c.groups;for(let u=0,r=i.length;u<r;u++){let b=i[u],X0=l[b.materialIndex];if(X0&&X0.visible){let g=L(w,X0,z,V);w.onBeforeShadow(J,w,S,p,c,g,b),J.renderBufferDirect(p,null,c,g,w,b),w.onAfterShadow(J,w,S,p,c,g,b)}}}else if(l.visible){let i=L(w,l,z,V);w.onBeforeShadow(J,w,S,p,c,i,null),J.renderBufferDirect(p,null,c,i,w,null),w.onAfterShadow(J,w,S,p,c,i,null)}}}let m=w.children;for(let c=0,l=m.length;c<l;c++)_(m[c],S,p,z,V)}function j(w){w.target.removeEventListener("dispose",j);for(let p in U){let z=U[p],V=w.target.uuid;if(V in z)z[V].dispose(),delete z[V]}}}var Rq={[D7]:M7,[L7]:B7,[V7]:C7,[C6]:z7,[M7]:D7,[B7]:L7,[C7]:V7,[z7]:C6};function kq(J,Q){function $(){let T=!1,K0=new a0,H0=null,F0=new a0(0,0,0,0);return{setMask:function(t){if(H0!==t&&!T)J.colorMask(t,t,t,t),H0=t},setLocked:function(t){T=t},setClear:function(t,o,R0,b0,WJ){if(WJ===!0)t*=b0,o*=b0,R0*=b0;if(K0.set(t,o,R0,b0),F0.equals(K0)===!1)J.clearColor(t,o,R0,b0),F0.copy(K0)},reset:function(){T=!1,H0=null,F0.set(-1,0,0,0)}}}function Z(){let T=!1,K0=!1,H0=null,F0=null,t=null;return{setReversed:function(o){if(K0!==o){let R0=Q.get("EXT_clip_control");if(o)R0.clipControlEXT(R0.LOWER_LEFT_EXT,R0.ZERO_TO_ONE_EXT);else R0.clipControlEXT(R0.LOWER_LEFT_EXT,R0.NEGATIVE_ONE_TO_ONE_EXT);K0=o;let b0=t;t=null,this.setClear(b0)}},getReversed:function(){return K0},setTest:function(o){if(o)Q0(J.DEPTH_TEST);else M0(J.DEPTH_TEST)},setMask:function(o){if(H0!==o&&!T)J.depthMask(o),H0=o},setFunc:function(o){if(K0)o=Rq[o];if(F0!==o){switch(o){case D7:J.depthFunc(J.NEVER);break;case M7:J.depthFunc(J.ALWAYS);break;case L7:J.depthFunc(J.LESS);break;case C6:J.depthFunc(J.LEQUAL);break;case V7:J.depthFunc(J.EQUAL);break;case z7:J.depthFunc(J.GEQUAL);break;case B7:J.depthFunc(J.GREATER);break;case C7:J.depthFunc(J.NOTEQUAL);break;default:J.depthFunc(J.LEQUAL)}F0=o}},setLocked:function(o){T=o},setClear:function(o){if(t!==o){if(K0)o=1-o;J.clearDepth(o),t=o}},reset:function(){T=!1,H0=null,F0=null,t=null,K0=!1}}}function W(){let T=!1,K0=null,H0=null,F0=null,t=null,o=null,R0=null,b0=null,WJ=null;return{setTest:function(JJ){if(!T)if(JJ)Q0(J.STENCIL_TEST);else M0(J.STENCIL_TEST)},setMask:function(JJ){if(K0!==JJ&&!T)J.stencilMask(JJ),K0=JJ},setFunc:function(JJ,R8,k8){if(H0!==JJ||F0!==R8||t!==k8)J.stencilFunc(JJ,R8,k8),H0=JJ,F0=R8,t=k8},setOp:function(JJ,R8,k8){if(o!==JJ||R0!==R8||b0!==k8)J.stencilOp(JJ,R8,k8),o=JJ,R0=R8,b0=k8},setLocked:function(JJ){T=JJ},setClear:function(JJ){if(WJ!==JJ)J.clearStencil(JJ),WJ=JJ},reset:function(){T=!1,K0=null,H0=null,F0=null,t=null,o=null,R0=null,b0=null,WJ=null}}}let H=new $,Y=new Z,X=new W,K=new WeakMap,U=new WeakMap,G={},q={},E=new WeakMap,O=[],D=null,k=!1,N=null,F=null,C=null,L=null,_=null,j=null,w=null,S=new P0(0,0,0),p=0,z=!1,V=null,A=null,m=null,c=null,l=null,i=J.getParameter(J.MAX_COMBINED_TEXTURE_IMAGE_UNITS),u=!1,r=0,b=J.getParameter(J.VERSION);if(b.indexOf("WebGL")!==-1)r=parseFloat(/^WebGL (\d)/.exec(b)[1]),u=r>=1;else if(b.indexOf("OpenGL ES")!==-1)r=parseFloat(/^OpenGL ES (\d)/.exec(b)[1]),u=r>=2;let X0=null,g={},$0=J.getParameter(J.SCISSOR_BOX),w0=J.getParameter(J.VIEWPORT),u0=new a0().fromArray($0),s0=new a0().fromArray(w0);function n(T,K0,H0,F0){let t=new Uint8Array(4),o=J.createTexture();J.bindTexture(T,o),J.texParameteri(T,J.TEXTURE_MIN_FILTER,J.NEAREST),J.texParameteri(T,J.TEXTURE_MAG_FILTER,J.NEAREST);for(let R0=0;R0<H0;R0++)if(T===J.TEXTURE_3D||T===J.TEXTURE_2D_ARRAY)J.texImage3D(K0,0,J.RGBA,1,1,F0,0,J.RGBA,J.UNSIGNED_BYTE,t);else J.texImage2D(K0+R0,0,J.RGBA,1,1,0,J.RGBA,J.UNSIGNED_BYTE,t);return o}let W0={};W0[J.TEXTURE_2D]=n(J.TEXTURE_2D,J.TEXTURE_2D,1),W0[J.TEXTURE_CUBE_MAP]=n(J.TEXTURE_CUBE_MAP,J.TEXTURE_CUBE_MAP_POSITIVE_X,6),W0[J.TEXTURE_2D_ARRAY]=n(J.TEXTURE_2D_ARRAY,J.TEXTURE_2D_ARRAY,1,1),W0[J.TEXTURE_3D]=n(J.TEXTURE_3D,J.TEXTURE_3D,1,1),H.setClear(0,0,0,1),Y.setClear(1),X.setClear(0),Q0(J.DEPTH_TEST),Y.setFunc(C6),k0(!1),qJ(oQ),Q0(J.CULL_FACE),x0(a8);function Q0(T){if(G[T]!==!0)J.enable(T),G[T]=!0}function M0(T){if(G[T]!==!1)J.disable(T),G[T]=!1}function S0(T,K0){if(q[T]!==K0){if(J.bindFramebuffer(T,K0),q[T]=K0,T===J.DRAW_FRAMEBUFFER)q[J.FRAMEBUFFER]=K0;if(T===J.FRAMEBUFFER)q[J.DRAW_FRAMEBUFFER]=K0;return!0}return!1}function T0(T,K0){let H0=O,F0=!1;if(T){if(H0=E.get(K0),H0===void 0)H0=[],E.set(K0,H0);let t=T.textures;if(H0.length!==t.length||H0[0]!==J.COLOR_ATTACHMENT0){for(let o=0,R0=t.length;o<R0;o++)H0[o]=J.COLOR_ATTACHMENT0+o;H0.length=t.length,F0=!0}}else if(H0[0]!==J.BACK)H0[0]=J.BACK,F0=!0;if(F0)J.drawBuffers(H0)}function GJ(T){if(D!==T)return J.useProgram(T),D=T,!0;return!1}let I={[i9]:J.FUNC_ADD,[LW]:J.FUNC_SUBTRACT,[VW]:J.FUNC_REVERSE_SUBTRACT};I[zW]=J.MIN,I[BW]=J.MAX;let ZJ={[CW]:J.ZERO,[_W]:J.ONE,[wW]:J.SRC_COLOR,[PW]:J.SRC_ALPHA,[vW]:J.SRC_ALPHA_SATURATE,[jW]:J.DST_COLOR,[AW]:J.DST_ALPHA,[IW]:J.ONE_MINUS_SRC_COLOR,[TW]:J.ONE_MINUS_SRC_ALPHA,[yW]:J.ONE_MINUS_DST_COLOR,[SW]:J.ONE_MINUS_DST_ALPHA,[fW]:J.CONSTANT_COLOR,[hW]:J.ONE_MINUS_CONSTANT_COLOR,[xW]:J.CONSTANT_ALPHA,[bW]:J.ONE_MINUS_CONSTANT_ALPHA};function x0(T,K0,H0,F0,t,o,R0,b0,WJ,JJ){if(T===a8){if(k===!0)M0(J.BLEND),k=!1;return}if(k===!1)Q0(J.BLEND),k=!0;if(T!==MW){if(T!==N||JJ!==z){if(F!==i9||_!==i9)J.blendEquation(J.FUNC_ADD),F=i9,_=i9;if(JJ)switch(T){case B6:J.blendFuncSeparate(J.ONE,J.ONE_MINUS_SRC_ALPHA,J.ONE,J.ONE_MINUS_SRC_ALPHA);break;case aQ:J.blendFunc(J.ONE,J.ONE);break;case rQ:J.blendFuncSeparate(J.ZERO,J.ONE_MINUS_SRC_COLOR,J.ZERO,J.ONE);break;case tQ:J.blendFuncSeparate(J.DST_COLOR,J.ONE_MINUS_SRC_ALPHA,J.ZERO,J.ONE);break;default:console.error("THREE.WebGLState: Invalid blending: ",T);break}else switch(T){case B6:J.blendFuncSeparate(J.SRC_ALPHA,J.ONE_MINUS_SRC_ALPHA,J.ONE,J.ONE_MINUS_SRC_ALPHA);break;case aQ:J.blendFuncSeparate(J.SRC_ALPHA,J.ONE,J.ONE,J.ONE);break;case rQ:console.error("THREE.WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case tQ:console.error("THREE.WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:console.error("THREE.WebGLState: Invalid blending: ",T);break}C=null,L=null,j=null,w=null,S.set(0,0,0),p=0,N=T,z=JJ}return}if(t=t||K0,o=o||H0,R0=R0||F0,K0!==F||t!==_)J.blendEquationSeparate(I[K0],I[t]),F=K0,_=t;if(H0!==C||F0!==L||o!==j||R0!==w)J.blendFuncSeparate(ZJ[H0],ZJ[F0],ZJ[o],ZJ[R0]),C=H0,L=F0,j=o,w=R0;if(b0.equals(S)===!1||WJ!==p)J.blendColor(b0.r,b0.g,b0.b,WJ),S.copy(b0),p=WJ;N=T,z=!1}function h0(T,K0){T.side===$8?M0(J.CULL_FACE):Q0(J.CULL_FACE);let H0=T.side===uJ;if(K0)H0=!H0;k0(H0),T.blending===B6&&T.transparent===!1?x0(a8):x0(T.blending,T.blendEquation,T.blendSrc,T.blendDst,T.blendEquationAlpha,T.blendSrcAlpha,T.blendDstAlpha,T.blendColor,T.blendAlpha,T.premultipliedAlpha),Y.setFunc(T.depthFunc),Y.setTest(T.depthTest),Y.setMask(T.depthWrite),H.setMask(T.colorWrite);let F0=T.stencilWrite;if(X.setTest(F0),F0)X.setMask(T.stencilWriteMask),X.setFunc(T.stencilFunc,T.stencilRef,T.stencilFuncMask),X.setOp(T.stencilFail,T.stencilZFail,T.stencilZPass);I0(T.polygonOffset,T.polygonOffsetFactor,T.polygonOffsetUnits),T.alphaToCoverage===!0?Q0(J.SAMPLE_ALPHA_TO_COVERAGE):M0(J.SAMPLE_ALPHA_TO_COVERAGE)}function k0(T){if(V!==T){if(T)J.frontFace(J.CW);else J.frontFace(J.CCW);V=T}}function qJ(T){if(T!==kW){if(Q0(J.CULL_FACE),T!==A)if(T===oQ)J.cullFace(J.BACK);else if(T===DW)J.cullFace(J.FRONT);else J.cullFace(J.FRONT_AND_BACK)}else M0(J.CULL_FACE);A=T}function z0(T){if(T!==m){if(u)J.lineWidth(T);m=T}}function I0(T,K0,H0){if(T){if(Q0(J.POLYGON_OFFSET_FILL),c!==K0||l!==H0)J.polygonOffset(K0,H0),c=K0,l=H0}else M0(J.POLYGON_OFFSET_FILL)}function PJ(T){if(T)Q0(J.SCISSOR_TEST);else M0(J.SCISSOR_TEST)}function CJ(T){if(T===void 0)T=J.TEXTURE0+i-1;if(X0!==T)J.activeTexture(T),X0=T}function RJ(T,K0,H0){if(H0===void 0)if(X0===null)H0=J.TEXTURE0+i-1;else H0=X0;let F0=g[H0];if(F0===void 0)F0={type:void 0,texture:void 0},g[H0]=F0;if(F0.type!==T||F0.texture!==K0){if(X0!==H0)J.activeTexture(H0),X0=H0;J.bindTexture(T,K0||W0[T]),F0.type=T,F0.texture=K0}}function B(){let T=g[X0];if(T!==void 0&&T.type!==void 0)J.bindTexture(T.type,null),T.type=void 0,T.texture=void 0}function R(){try{J.compressedTexImage2D(...arguments)}catch(T){console.error("THREE.WebGLState:",T)}}function f(){try{J.compressedTexImage3D(...arguments)}catch(T){console.error("THREE.WebGLState:",T)}}function s(){try{J.texSubImage2D(...arguments)}catch(T){console.error("THREE.WebGLState:",T)}}function a(){try{J.texSubImage3D(...arguments)}catch(T){console.error("THREE.WebGLState:",T)}}function d(){try{J.compressedTexSubImage2D(...arguments)}catch(T){console.error("THREE.WebGLState:",T)}}function N0(){try{J.compressedTexSubImage3D(...arguments)}catch(T){console.error("THREE.WebGLState:",T)}}function Z0(){try{J.texStorage2D(...arguments)}catch(T){console.error("THREE.WebGLState:",T)}}function D0(){try{J.texStorage3D(...arguments)}catch(T){console.error("THREE.WebGLState:",T)}}function y0(){try{J.texImage2D(...arguments)}catch(T){console.error("THREE.WebGLState:",T)}}function J0(){try{J.texImage3D(...arguments)}catch(T){console.error("THREE.WebGLState:",T)}}function G0(T){if(u0.equals(T)===!1)J.scissor(T.x,T.y,T.z,T.w),u0.copy(T)}function L0(T){if(s0.equals(T)===!1)J.viewport(T.x,T.y,T.z,T.w),s0.copy(T)}function V0(T,K0){let H0=U.get(K0);if(H0===void 0)H0=new WeakMap,U.set(K0,H0);let F0=H0.get(T);if(F0===void 0)F0=J.getUniformBlockIndex(K0,T.name),H0.set(T,F0)}function q0(T,K0){let F0=U.get(K0).get(T);if(K.get(K0)!==F0)J.uniformBlockBinding(K0,F0,T.__bindingPointIndex),K.set(K0,F0)}function l0(){J.disable(J.BLEND),J.disable(J.CULL_FACE),J.disable(J.DEPTH_TEST),J.disable(J.POLYGON_OFFSET_FILL),J.disable(J.SCISSOR_TEST),J.disable(J.STENCIL_TEST),J.disable(J.SAMPLE_ALPHA_TO_COVERAGE),J.blendEquation(J.FUNC_ADD),J.blendFunc(J.ONE,J.ZERO),J.blendFuncSeparate(J.ONE,J.ZERO,J.ONE,J.ZERO),J.blendColor(0,0,0,0),J.colorMask(!0,!0,!0,!0),J.clearColor(0,0,0,0),J.depthMask(!0),J.depthFunc(J.LESS),Y.setReversed(!1),J.clearDepth(1),J.stencilMask(4294967295),J.stencilFunc(J.ALWAYS,0,4294967295),J.stencilOp(J.KEEP,J.KEEP,J.KEEP),J.clearStencil(0),J.cullFace(J.BACK),J.frontFace(J.CCW),J.polygonOffset(0,0),J.activeTexture(J.TEXTURE0),J.bindFramebuffer(J.FRAMEBUFFER,null),J.bindFramebuffer(J.DRAW_FRAMEBUFFER,null),J.bindFramebuffer(J.READ_FRAMEBUFFER,null),J.useProgram(null),J.lineWidth(1),J.scissor(0,0,J.canvas.width,J.canvas.height),J.viewport(0,0,J.canvas.width,J.canvas.height),G={},X0=null,g={},q={},E=new WeakMap,O=[],D=null,k=!1,N=null,F=null,C=null,L=null,_=null,j=null,w=null,S=new P0(0,0,0),p=0,z=!1,V=null,A=null,m=null,c=null,l=null,u0.set(0,0,J.canvas.width,J.canvas.height),s0.set(0,0,J.canvas.width,J.canvas.height),H.reset(),Y.reset(),X.reset()}return{buffers:{color:H,depth:Y,stencil:X},enable:Q0,disable:M0,bindFramebuffer:S0,drawBuffers:T0,useProgram:GJ,setBlending:x0,setMaterial:h0,setFlipSided:k0,setCullFace:qJ,setLineWidth:z0,setPolygonOffset:I0,setScissorTest:PJ,activeTexture:CJ,bindTexture:RJ,unbindTexture:B,compressedTexImage2D:R,compressedTexImage3D:f,texImage2D:y0,texImage3D:J0,updateUBOMapping:V0,uniformBlockBinding:q0,texStorage2D:Z0,texStorage3D:D0,texSubImage2D:s,texSubImage3D:a,compressedTexSubImage2D:d,compressedTexSubImage3D:N0,scissor:G0,viewport:L0,reset:l0}}function Dq(J,Q,$,Z,W,H,Y){let X=Q.has("WEBGL_multisampled_render_to_texture")?Q.get("WEBGL_multisampled_render_to_texture"):null,K=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),U=new _0,G=new WeakMap,q,E=new WeakMap,O=!1;try{O=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch(B){}function D(B,R){return O?new OffscreenCanvas(B,R):s9("canvas")}function k(B,R,f){let s=1,a=RJ(B);if(a.width>f||a.height>f)s=f/Math.max(a.width,a.height);if(s<1)if(typeof HTMLImageElement<"u"&&B instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&B instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&B instanceof ImageBitmap||typeof VideoFrame<"u"&&B instanceof VideoFrame){let d=Math.floor(s*a.width),N0=Math.floor(s*a.height);if(q===void 0)q=D(d,N0);let Z0=R?D(d,N0):q;return Z0.width=d,Z0.height=N0,Z0.getContext("2d").drawImage(B,0,0,d,N0),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+a.width+"x"+a.height+") to ("+d+"x"+N0+")."),Z0}else{if("data"in B)console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+a.width+"x"+a.height+").");return B}return B}function N(B){return B.generateMipmaps}function F(B){J.generateMipmap(B)}function C(B){if(B.isWebGLCubeRenderTarget)return J.TEXTURE_CUBE_MAP;if(B.isWebGL3DRenderTarget)return J.TEXTURE_3D;if(B.isWebGLArrayRenderTarget||B.isCompressedArrayTexture)return J.TEXTURE_2D_ARRAY;return J.TEXTURE_2D}function L(B,R,f,s,a=!1){if(B!==null){if(J[B]!==void 0)return J[B];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+B+"'")}let d=R;if(R===J.RED){if(f===J.FLOAT)d=J.R32F;if(f===J.HALF_FLOAT)d=J.R16F;if(f===J.UNSIGNED_BYTE)d=J.R8}if(R===J.RED_INTEGER){if(f===J.UNSIGNED_BYTE)d=J.R8UI;if(f===J.UNSIGNED_SHORT)d=J.R16UI;if(f===J.UNSIGNED_INT)d=J.R32UI;if(f===J.BYTE)d=J.R8I;if(f===J.SHORT)d=J.R16I;if(f===J.INT)d=J.R32I}if(R===J.RG){if(f===J.FLOAT)d=J.RG32F;if(f===J.HALF_FLOAT)d=J.RG16F;if(f===J.UNSIGNED_BYTE)d=J.RG8}if(R===J.RG_INTEGER){if(f===J.UNSIGNED_BYTE)d=J.RG8UI;if(f===J.UNSIGNED_SHORT)d=J.RG16UI;if(f===J.UNSIGNED_INT)d=J.RG32UI;if(f===J.BYTE)d=J.RG8I;if(f===J.SHORT)d=J.RG16I;if(f===J.INT)d=J.RG32I}if(R===J.RGB_INTEGER){if(f===J.UNSIGNED_BYTE)d=J.RGB8UI;if(f===J.UNSIGNED_SHORT)d=J.RGB16UI;if(f===J.UNSIGNED_INT)d=J.RGB32UI;if(f===J.BYTE)d=J.RGB8I;if(f===J.SHORT)d=J.RGB16I;if(f===J.INT)d=J.RGB32I}if(R===J.RGBA_INTEGER){if(f===J.UNSIGNED_BYTE)d=J.RGBA8UI;if(f===J.UNSIGNED_SHORT)d=J.RGBA16UI;if(f===J.UNSIGNED_INT)d=J.RGBA32UI;if(f===J.BYTE)d=J.RGBA8I;if(f===J.SHORT)d=J.RGBA16I;if(f===J.INT)d=J.RGBA32I}if(R===J.RGB){if(f===J.UNSIGNED_INT_5_9_9_9_REV)d=J.RGB9_E5;if(f===J.UNSIGNED_INT_10F_11F_11F_REV)d=J.R11F_G11F_B10F}if(R===J.RGBA){let N0=a?f$:n0.getTransfer(s);if(f===J.FLOAT)d=J.RGBA32F;if(f===J.HALF_FLOAT)d=J.RGBA16F;if(f===J.UNSIGNED_BYTE)d=N0===XJ?J.SRGB8_ALPHA8:J.RGBA8;if(f===J.UNSIGNED_SHORT_4_4_4_4)d=J.RGBA4;if(f===J.UNSIGNED_SHORT_5_5_5_1)d=J.RGB5_A1}if(d===J.R16F||d===J.R32F||d===J.RG16F||d===J.RG32F||d===J.RGBA16F||d===J.RGBA32F)Q.get("EXT_color_buffer_float");return d}function _(B,R){let f;if(B){if(R===null||R===e9||R===J6)f=J.DEPTH24_STENCIL8;else if(R===t8)f=J.DEPTH32F_STENCIL8;else if(R===w6)f=J.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")}else if(R===null||R===e9||R===J6)f=J.DEPTH_COMPONENT24;else if(R===t8)f=J.DEPTH_COMPONENT32F;else if(R===w6)f=J.DEPTH_COMPONENT16;return f}function j(B,R){if(N(B)===!0||B.isFramebufferTexture&&B.minFilter!==f8&&B.minFilter!==E8)return Math.log2(Math.max(R.width,R.height))+1;else if(B.mipmaps!==void 0&&B.mipmaps.length>0)return B.mipmaps.length;else if(B.isCompressedTexture&&Array.isArray(B.image))return R.mipmaps.length;else return 1}function w(B){let R=B.target;if(R.removeEventListener("dispose",w),p(R),R.isVideoTexture)G.delete(R)}function S(B){let R=B.target;R.removeEventListener("dispose",S),V(R)}function p(B){let R=Z.get(B);if(R.__webglInit===void 0)return;let f=B.source,s=E.get(f);if(s){let a=s[R.__cacheKey];if(a.usedTimes--,a.usedTimes===0)z(B);if(Object.keys(s).length===0)E.delete(f)}Z.remove(B)}function z(B){let R=Z.get(B);J.deleteTexture(R.__webglTexture);let f=B.source,s=E.get(f);delete s[R.__cacheKey],Y.memory.textures--}function V(B){let R=Z.get(B);if(B.depthTexture)B.depthTexture.dispose(),Z.remove(B.depthTexture);if(B.isWebGLCubeRenderTarget)for(let s=0;s<6;s++){if(Array.isArray(R.__webglFramebuffer[s]))for(let a=0;a<R.__webglFramebuffer[s].length;a++)J.deleteFramebuffer(R.__webglFramebuffer[s][a]);else J.deleteFramebuffer(R.__webglFramebuffer[s]);if(R.__webglDepthbuffer)J.deleteRenderbuffer(R.__webglDepthbuffer[s])}else{if(Array.isArray(R.__webglFramebuffer))for(let s=0;s<R.__webglFramebuffer.length;s++)J.deleteFramebuffer(R.__webglFramebuffer[s]);else J.deleteFramebuffer(R.__webglFramebuffer);if(R.__webglDepthbuffer)J.deleteRenderbuffer(R.__webglDepthbuffer);if(R.__webglMultisampledFramebuffer)J.deleteFramebuffer(R.__webglMultisampledFramebuffer);if(R.__webglColorRenderbuffer){for(let s=0;s<R.__webglColorRenderbuffer.length;s++)if(R.__webglColorRenderbuffer[s])J.deleteRenderbuffer(R.__webglColorRenderbuffer[s])}if(R.__webglDepthRenderbuffer)J.deleteRenderbuffer(R.__webglDepthRenderbuffer)}let f=B.textures;for(let s=0,a=f.length;s<a;s++){let d=Z.get(f[s]);if(d.__webglTexture)J.deleteTexture(d.__webglTexture),Y.memory.textures--;Z.remove(f[s])}Z.remove(B)}let A=0;function m(){A=0}function c(){let B=A;if(B>=W.maxTextures)console.warn("THREE.WebGLTextures: Trying to use "+B+" texture units while this GPU supports only "+W.maxTextures);return A+=1,B}function l(B){let R=[];return R.push(B.wrapS),R.push(B.wrapT),R.push(B.wrapR||0),R.push(B.magFilter),R.push(B.minFilter),R.push(B.anisotropy),R.push(B.internalFormat),R.push(B.format),R.push(B.type),R.push(B.generateMipmaps),R.push(B.premultiplyAlpha),R.push(B.flipY),R.push(B.unpackAlignment),R.push(B.colorSpace),R.join()}function i(B,R){let f=Z.get(B);if(B.isVideoTexture)PJ(B);if(B.isRenderTargetTexture===!1&&B.isExternalTexture!==!0&&B.version>0&&f.__version!==B.version){let s=B.image;if(s===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(s.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{W0(f,B,R);return}}else if(B.isExternalTexture)f.__webglTexture=B.sourceTexture?B.sourceTexture:null;$.bindTexture(J.TEXTURE_2D,f.__webglTexture,J.TEXTURE0+R)}function u(B,R){let f=Z.get(B);if(B.isRenderTargetTexture===!1&&B.version>0&&f.__version!==B.version){W0(f,B,R);return}$.bindTexture(J.TEXTURE_2D_ARRAY,f.__webglTexture,J.TEXTURE0+R)}function r(B,R){let f=Z.get(B);if(B.isRenderTargetTexture===!1&&B.version>0&&f.__version!==B.version){W0(f,B,R);return}$.bindTexture(J.TEXTURE_3D,f.__webglTexture,J.TEXTURE0+R)}function b(B,R){let f=Z.get(B);if(B.version>0&&f.__version!==B.version){Q0(f,B,R);return}$.bindTexture(J.TEXTURE_CUBE_MAP,f.__webglTexture,J.TEXTURE0+R)}let X0={[r9]:J.REPEAT,[P7]:J.CLAMP_TO_EDGE,[T7]:J.MIRRORED_REPEAT},g={[f8]:J.NEAREST,[A7]:J.NEAREST_MIPMAP_NEAREST,[k9]:J.NEAREST_MIPMAP_LINEAR,[E8]:J.LINEAR,[t9]:J.LINEAR_MIPMAP_NEAREST,[h8]:J.LINEAR_MIPMAP_LINEAR},$0={[HH]:J.NEVER,[qH]:J.ALWAYS,[YH]:J.LESS,[h$]:J.LEQUAL,[XH]:J.EQUAL,[GH]:J.GEQUAL,[KH]:J.GREATER,[UH]:J.NOTEQUAL};function w0(B,R){if(R.type===t8&&Q.has("OES_texture_float_linear")===!1&&(R.magFilter===E8||R.magFilter===t9||R.magFilter===k9||R.magFilter===h8||R.minFilter===E8||R.minFilter===t9||R.minFilter===k9||R.minFilter===h8))console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.");if(J.texParameteri(B,J.TEXTURE_WRAP_S,X0[R.wrapS]),J.texParameteri(B,J.TEXTURE_WRAP_T,X0[R.wrapT]),B===J.TEXTURE_3D||B===J.TEXTURE_2D_ARRAY)J.texParameteri(B,J.TEXTURE_WRAP_R,X0[R.wrapR]);if(J.texParameteri(B,J.TEXTURE_MAG_FILTER,g[R.magFilter]),J.texParameteri(B,J.TEXTURE_MIN_FILTER,g[R.minFilter]),R.compareFunction)J.texParameteri(B,J.TEXTURE_COMPARE_MODE,J.COMPARE_REF_TO_TEXTURE),J.texParameteri(B,J.TEXTURE_COMPARE_FUNC,$0[R.compareFunction]);if(Q.has("EXT_texture_filter_anisotropic")===!0){if(R.magFilter===f8)return;if(R.minFilter!==k9&&R.minFilter!==h8)return;if(R.type===t8&&Q.has("OES_texture_float_linear")===!1)return;if(R.anisotropy>1||Z.get(R).__currentAnisotropy){let f=Q.get("EXT_texture_filter_anisotropic");J.texParameterf(B,f.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(R.anisotropy,W.getMaxAnisotropy())),Z.get(R).__currentAnisotropy=R.anisotropy}}}function u0(B,R){let f=!1;if(B.__webglInit===void 0)B.__webglInit=!0,R.addEventListener("dispose",w);let s=R.source,a=E.get(s);if(a===void 0)a={},E.set(s,a);let d=l(R);if(d!==B.__cacheKey){if(a[d]===void 0)a[d]={texture:J.createTexture(),usedTimes:0},Y.memory.textures++,f=!0;a[d].usedTimes++;let N0=a[B.__cacheKey];if(N0!==void 0){if(a[B.__cacheKey].usedTimes--,N0.usedTimes===0)z(R)}B.__cacheKey=d,B.__webglTexture=a[d].texture}return f}function s0(B,R,f){return Math.floor(Math.floor(B/f)/R)}function n(B,R,f,s){let d=B.updateRanges;if(d.length===0)$.texSubImage2D(J.TEXTURE_2D,0,0,0,R.width,R.height,f,s,R.data);else{d.sort((J0,G0)=>J0.start-G0.start);let N0=0;for(let J0=1;J0<d.length;J0++){let G0=d[N0],L0=d[J0],V0=G0.start+G0.count,q0=s0(L0.start,R.width,4),l0=s0(G0.start,R.width,4);if(L0.start<=V0+1&&q0===l0&&s0(L0.start+L0.count-1,R.width,4)===q0)G0.count=Math.max(G0.count,L0.start+L0.count-G0.start);else++N0,d[N0]=L0}d.length=N0+1;let Z0=J.getParameter(J.UNPACK_ROW_LENGTH),D0=J.getParameter(J.UNPACK_SKIP_PIXELS),y0=J.getParameter(J.UNPACK_SKIP_ROWS);J.pixelStorei(J.UNPACK_ROW_LENGTH,R.width);for(let J0=0,G0=d.length;J0<G0;J0++){let L0=d[J0],V0=Math.floor(L0.start/4),q0=Math.ceil(L0.count/4),l0=V0%R.width,T=Math.floor(V0/R.width),K0=q0,H0=1;J.pixelStorei(J.UNPACK_SKIP_PIXELS,l0),J.pixelStorei(J.UNPACK_SKIP_ROWS,T),$.texSubImage2D(J.TEXTURE_2D,0,l0,T,K0,1,f,s,R.data)}B.clearUpdateRanges(),J.pixelStorei(J.UNPACK_ROW_LENGTH,Z0),J.pixelStorei(J.UNPACK_SKIP_PIXELS,D0),J.pixelStorei(J.UNPACK_SKIP_ROWS,y0)}}function W0(B,R,f){let s=J.TEXTURE_2D;if(R.isDataArrayTexture||R.isCompressedArrayTexture)s=J.TEXTURE_2D_ARRAY;if(R.isData3DTexture)s=J.TEXTURE_3D;let a=u0(B,R),d=R.source;$.bindTexture(s,B.__webglTexture,J.TEXTURE0+f);let N0=Z.get(d);if(d.version!==N0.__version||a===!0){$.activeTexture(J.TEXTURE0+f);let Z0=n0.getPrimaries(n0.workingColorSpace),D0=R.colorSpace===D9?null:n0.getPrimaries(R.colorSpace),y0=R.colorSpace===D9||Z0===D0?J.NONE:J.BROWSER_DEFAULT_WEBGL;J.pixelStorei(J.UNPACK_FLIP_Y_WEBGL,R.flipY),J.pixelStorei(J.UNPACK_PREMULTIPLY_ALPHA_WEBGL,R.premultiplyAlpha),J.pixelStorei(J.UNPACK_ALIGNMENT,R.unpackAlignment),J.pixelStorei(J.UNPACK_COLORSPACE_CONVERSION_WEBGL,y0);let J0=k(R.image,!1,W.maxTextureSize);J0=CJ(R,J0);let G0=H.convert(R.format,R.colorSpace),L0=H.convert(R.type),V0=L(R.internalFormat,G0,L0,R.colorSpace,R.isVideoTexture);w0(s,R);let q0,l0=R.mipmaps,T=R.isVideoTexture!==!0,K0=N0.__version===void 0||a===!0,H0=d.dataReady,F0=j(R,J0);if(R.isDepthTexture){if(V0=_(R.format===P6,R.type),K0)if(T)$.texStorage2D(J.TEXTURE_2D,1,V0,J0.width,J0.height);else $.texImage2D(J.TEXTURE_2D,0,V0,J0.width,J0.height,0,G0,L0,null)}else if(R.isDataTexture)if(l0.length>0){if(T&&K0)$.texStorage2D(J.TEXTURE_2D,F0,V0,l0[0].width,l0[0].height);for(let t=0,o=l0.length;t<o;t++)if(q0=l0[t],T){if(H0)$.texSubImage2D(J.TEXTURE_2D,t,0,0,q0.width,q0.height,G0,L0,q0.data)}else $.texImage2D(J.TEXTURE_2D,t,V0,q0.width,q0.height,0,G0,L0,q0.data);R.generateMipmaps=!1}else if(T){if(K0)$.texStorage2D(J.TEXTURE_2D,F0,V0,J0.width,J0.height);if(H0)n(R,J0,G0,L0)}else $.texImage2D(J.TEXTURE_2D,0,V0,J0.width,J0.height,0,G0,L0,J0.data);else if(R.isCompressedTexture)if(R.isCompressedArrayTexture){if(T&&K0)$.texStorage3D(J.TEXTURE_2D_ARRAY,F0,V0,l0[0].width,l0[0].height,J0.depth);for(let t=0,o=l0.length;t<o;t++)if(q0=l0[t],R.format!==V8)if(G0!==null)if(T){if(H0)if(R.layerUpdates.size>0){let R0=WZ(q0.width,q0.height,R.format,R.type);for(let b0 of R.layerUpdates){let WJ=q0.data.subarray(b0*R0/q0.data.BYTES_PER_ELEMENT,(b0+1)*R0/q0.data.BYTES_PER_ELEMENT);$.compressedTexSubImage3D(J.TEXTURE_2D_ARRAY,t,0,0,b0,q0.width,q0.height,1,G0,WJ)}R.clearLayerUpdates()}else $.compressedTexSubImage3D(J.TEXTURE_2D_ARRAY,t,0,0,0,q0.width,q0.height,J0.depth,G0,q0.data)}else $.compressedTexImage3D(J.TEXTURE_2D_ARRAY,t,V0,q0.width,q0.height,J0.depth,0,q0.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else if(T){if(H0)$.texSubImage3D(J.TEXTURE_2D_ARRAY,t,0,0,0,q0.width,q0.height,J0.depth,G0,L0,q0.data)}else $.texImage3D(J.TEXTURE_2D_ARRAY,t,V0,q0.width,q0.height,J0.depth,0,G0,L0,q0.data)}else{if(T&&K0)$.texStorage2D(J.TEXTURE_2D,F0,V0,l0[0].width,l0[0].height);for(let t=0,o=l0.length;t<o;t++)if(q0=l0[t],R.format!==V8)if(G0!==null)if(T){if(H0)$.compressedTexSubImage2D(J.TEXTURE_2D,t,0,0,q0.width,q0.height,G0,q0.data)}else $.compressedTexImage2D(J.TEXTURE_2D,t,V0,q0.width,q0.height,0,q0.data);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else if(T){if(H0)$.texSubImage2D(J.TEXTURE_2D,t,0,0,q0.width,q0.height,G0,L0,q0.data)}else $.texImage2D(J.TEXTURE_2D,t,V0,q0.width,q0.height,0,G0,L0,q0.data)}else if(R.isDataArrayTexture)if(T){if(K0)$.texStorage3D(J.TEXTURE_2D_ARRAY,F0,V0,J0.width,J0.height,J0.depth);if(H0)if(R.layerUpdates.size>0){let t=WZ(J0.width,J0.height,R.format,R.type);for(let o of R.layerUpdates){let R0=J0.data.subarray(o*t/J0.data.BYTES_PER_ELEMENT,(o+1)*t/J0.data.BYTES_PER_ELEMENT);$.texSubImage3D(J.TEXTURE_2D_ARRAY,0,0,0,o,J0.width,J0.height,1,G0,L0,R0)}R.clearLayerUpdates()}else $.texSubImage3D(J.TEXTURE_2D_ARRAY,0,0,0,0,J0.width,J0.height,J0.depth,G0,L0,J0.data)}else $.texImage3D(J.TEXTURE_2D_ARRAY,0,V0,J0.width,J0.height,J0.depth,0,G0,L0,J0.data);else if(R.isData3DTexture)if(T){if(K0)$.texStorage3D(J.TEXTURE_3D,F0,V0,J0.width,J0.height,J0.depth);if(H0)$.texSubImage3D(J.TEXTURE_3D,0,0,0,0,J0.width,J0.height,J0.depth,G0,L0,J0.data)}else $.texImage3D(J.TEXTURE_3D,0,V0,J0.width,J0.height,J0.depth,0,G0,L0,J0.data);else if(R.isFramebufferTexture){if(K0)if(T)$.texStorage2D(J.TEXTURE_2D,F0,V0,J0.width,J0.height);else{let{width:t,height:o}=J0;for(let R0=0;R0<F0;R0++)$.texImage2D(J.TEXTURE_2D,R0,V0,t,o,0,G0,L0,null),t>>=1,o>>=1}}else if(l0.length>0){if(T&&K0){let t=RJ(l0[0]);$.texStorage2D(J.TEXTURE_2D,F0,V0,t.width,t.height)}for(let t=0,o=l0.length;t<o;t++)if(q0=l0[t],T){if(H0)$.texSubImage2D(J.TEXTURE_2D,t,0,0,G0,L0,q0)}else $.texImage2D(J.TEXTURE_2D,t,V0,G0,L0,q0);R.generateMipmaps=!1}else if(T){if(K0){let t=RJ(J0);$.texStorage2D(J.TEXTURE_2D,F0,V0,t.width,t.height)}if(H0)$.texSubImage2D(J.TEXTURE_2D,0,0,0,G0,L0,J0)}else $.texImage2D(J.TEXTURE_2D,0,V0,G0,L0,J0);if(N(R))F(s);if(N0.__version=d.version,R.onUpdate)R.onUpdate(R)}B.__version=R.version}function Q0(B,R,f){if(R.image.length!==6)return;let s=u0(B,R),a=R.source;$.bindTexture(J.TEXTURE_CUBE_MAP,B.__webglTexture,J.TEXTURE0+f);let d=Z.get(a);if(a.version!==d.__version||s===!0){$.activeTexture(J.TEXTURE0+f);let N0=n0.getPrimaries(n0.workingColorSpace),Z0=R.colorSpace===D9?null:n0.getPrimaries(R.colorSpace),D0=R.colorSpace===D9||N0===Z0?J.NONE:J.BROWSER_DEFAULT_WEBGL;J.pixelStorei(J.UNPACK_FLIP_Y_WEBGL,R.flipY),J.pixelStorei(J.UNPACK_PREMULTIPLY_ALPHA_WEBGL,R.premultiplyAlpha),J.pixelStorei(J.UNPACK_ALIGNMENT,R.unpackAlignment),J.pixelStorei(J.UNPACK_COLORSPACE_CONVERSION_WEBGL,D0);let y0=R.isCompressedTexture||R.image[0].isCompressedTexture,J0=R.image[0]&&R.image[0].isDataTexture,G0=[];for(let o=0;o<6;o++){if(!y0&&!J0)G0[o]=k(R.image[o],!0,W.maxCubemapSize);else G0[o]=J0?R.image[o].image:R.image[o];G0[o]=CJ(R,G0[o])}let L0=G0[0],V0=H.convert(R.format,R.colorSpace),q0=H.convert(R.type),l0=L(R.internalFormat,V0,q0,R.colorSpace),T=R.isVideoTexture!==!0,K0=d.__version===void 0||s===!0,H0=a.dataReady,F0=j(R,L0);w0(J.TEXTURE_CUBE_MAP,R);let t;if(y0){if(T&&K0)$.texStorage2D(J.TEXTURE_CUBE_MAP,F0,l0,L0.width,L0.height);for(let o=0;o<6;o++){t=G0[o].mipmaps;for(let R0=0;R0<t.length;R0++){let b0=t[R0];if(R.format!==V8)if(V0!==null)if(T){if(H0)$.compressedTexSubImage2D(J.TEXTURE_CUBE_MAP_POSITIVE_X+o,R0,0,0,b0.width,b0.height,V0,b0.data)}else $.compressedTexImage2D(J.TEXTURE_CUBE_MAP_POSITIVE_X+o,R0,l0,b0.width,b0.height,0,b0.data);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()");else if(T){if(H0)$.texSubImage2D(J.TEXTURE_CUBE_MAP_POSITIVE_X+o,R0,0,0,b0.width,b0.height,V0,q0,b0.data)}else $.texImage2D(J.TEXTURE_CUBE_MAP_POSITIVE_X+o,R0,l0,b0.width,b0.height,0,V0,q0,b0.data)}}}else{if(t=R.mipmaps,T&&K0){if(t.length>0)F0++;let o=RJ(G0[0]);$.texStorage2D(J.TEXTURE_CUBE_MAP,F0,l0,o.width,o.height)}for(let o=0;o<6;o++)if(J0){if(T){if(H0)$.texSubImage2D(J.TEXTURE_CUBE_MAP_POSITIVE_X+o,0,0,0,G0[o].width,G0[o].height,V0,q0,G0[o].data)}else $.texImage2D(J.TEXTURE_CUBE_MAP_POSITIVE_X+o,0,l0,G0[o].width,G0[o].height,0,V0,q0,G0[o].data);for(let R0=0;R0<t.length;R0++){let WJ=t[R0].image[o].image;if(T){if(H0)$.texSubImage2D(J.TEXTURE_CUBE_MAP_POSITIVE_X+o,R0+1,0,0,WJ.width,WJ.height,V0,q0,WJ.data)}else $.texImage2D(J.TEXTURE_CUBE_MAP_POSITIVE_X+o,R0+1,l0,WJ.width,WJ.height,0,V0,q0,WJ.data)}}else{if(T){if(H0)$.texSubImage2D(J.TEXTURE_CUBE_MAP_POSITIVE_X+o,0,0,0,V0,q0,G0[o])}else $.texImage2D(J.TEXTURE_CUBE_MAP_POSITIVE_X+o,0,l0,V0,q0,G0[o]);for(let R0=0;R0<t.length;R0++){let b0=t[R0];if(T){if(H0)$.texSubImage2D(J.TEXTURE_CUBE_MAP_POSITIVE_X+o,R0+1,0,0,V0,q0,b0.image[o])}else $.texImage2D(J.TEXTURE_CUBE_MAP_POSITIVE_X+o,R0+1,l0,V0,q0,b0.image[o])}}}if(N(R))F(J.TEXTURE_CUBE_MAP);if(d.__version=a.version,R.onUpdate)R.onUpdate(R)}B.__version=R.version}function M0(B,R,f,s,a,d){let N0=H.convert(f.format,f.colorSpace),Z0=H.convert(f.type),D0=L(f.internalFormat,N0,Z0,f.colorSpace),y0=Z.get(R),J0=Z.get(f);if(J0.__renderTarget=R,!y0.__hasExternalTextures){let G0=Math.max(1,R.width>>d),L0=Math.max(1,R.height>>d);if(a===J.TEXTURE_3D||a===J.TEXTURE_2D_ARRAY)$.texImage3D(a,d,D0,G0,L0,R.depth,0,N0,Z0,null);else $.texImage2D(a,d,D0,G0,L0,0,N0,Z0,null)}if($.bindFramebuffer(J.FRAMEBUFFER,B),I0(R))X.framebufferTexture2DMultisampleEXT(J.FRAMEBUFFER,s,a,J0.__webglTexture,0,z0(R));else if(a===J.TEXTURE_2D||a>=J.TEXTURE_CUBE_MAP_POSITIVE_X&&a<=J.TEXTURE_CUBE_MAP_NEGATIVE_Z)J.framebufferTexture2D(J.FRAMEBUFFER,s,a,J0.__webglTexture,d);$.bindFramebuffer(J.FRAMEBUFFER,null)}function S0(B,R,f){if(J.bindRenderbuffer(J.RENDERBUFFER,B),R.depthBuffer){let s=R.depthTexture,a=s&&s.isDepthTexture?s.type:null,d=_(R.stencilBuffer,a),N0=R.stencilBuffer?J.DEPTH_STENCIL_ATTACHMENT:J.DEPTH_ATTACHMENT,Z0=z0(R);if(I0(R))X.renderbufferStorageMultisampleEXT(J.RENDERBUFFER,Z0,d,R.width,R.height);else if(f)J.renderbufferStorageMultisample(J.RENDERBUFFER,Z0,d,R.width,R.height);else J.renderbufferStorage(J.RENDERBUFFER,d,R.width,R.height);J.framebufferRenderbuffer(J.FRAMEBUFFER,N0,J.RENDERBUFFER,B)}else{let s=R.textures;for(let a=0;a<s.length;a++){let d=s[a],N0=H.convert(d.format,d.colorSpace),Z0=H.convert(d.type),D0=L(d.internalFormat,N0,Z0,d.colorSpace),y0=z0(R);if(f&&I0(R)===!1)J.renderbufferStorageMultisample(J.RENDERBUFFER,y0,D0,R.width,R.height);else if(I0(R))X.renderbufferStorageMultisampleEXT(J.RENDERBUFFER,y0,D0,R.width,R.height);else J.renderbufferStorage(J.RENDERBUFFER,D0,R.width,R.height)}}J.bindRenderbuffer(J.RENDERBUFFER,null)}function T0(B,R){if(R&&R.isWebGLCubeRenderTarget)throw Error("Depth Texture with cube render targets is not supported");if($.bindFramebuffer(J.FRAMEBUFFER,B),!(R.depthTexture&&R.depthTexture.isDepthTexture))throw Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");let s=Z.get(R.depthTexture);if(s.__renderTarget=R,!s.__webglTexture||R.depthTexture.image.width!==R.width||R.depthTexture.image.height!==R.height)R.depthTexture.image.width=R.width,R.depthTexture.image.height=R.height,R.depthTexture.needsUpdate=!0;i(R.depthTexture,0);let a=s.__webglTexture,d=z0(R);if(R.depthTexture.format===S7)if(I0(R))X.framebufferTexture2DMultisampleEXT(J.FRAMEBUFFER,J.DEPTH_ATTACHMENT,J.TEXTURE_2D,a,0,d);else J.framebufferTexture2D(J.FRAMEBUFFER,J.DEPTH_ATTACHMENT,J.TEXTURE_2D,a,0);else if(R.depthTexture.format===P6)if(I0(R))X.framebufferTexture2DMultisampleEXT(J.FRAMEBUFFER,J.DEPTH_STENCIL_ATTACHMENT,J.TEXTURE_2D,a,0,d);else J.framebufferTexture2D(J.FRAMEBUFFER,J.DEPTH_STENCIL_ATTACHMENT,J.TEXTURE_2D,a,0);else throw Error("Unknown depthTexture format")}function GJ(B){let R=Z.get(B),f=B.isWebGLCubeRenderTarget===!0;if(R.__boundDepthTexture!==B.depthTexture){let s=B.depthTexture;if(R.__depthDisposeCallback)R.__depthDisposeCallback();if(s){let a=()=>{delete R.__boundDepthTexture,delete R.__depthDisposeCallback,s.removeEventListener("dispose",a)};s.addEventListener("dispose",a),R.__depthDisposeCallback=a}R.__boundDepthTexture=s}if(B.depthTexture&&!R.__autoAllocateDepthBuffer){if(f)throw Error("target.depthTexture not supported in Cube render targets");let s=B.texture.mipmaps;if(s&&s.length>0)T0(R.__webglFramebuffer[0],B);else T0(R.__webglFramebuffer,B)}else if(f){R.__webglDepthbuffer=[];for(let s=0;s<6;s++)if($.bindFramebuffer(J.FRAMEBUFFER,R.__webglFramebuffer[s]),R.__webglDepthbuffer[s]===void 0)R.__webglDepthbuffer[s]=J.createRenderbuffer(),S0(R.__webglDepthbuffer[s],B,!1);else{let a=B.stencilBuffer?J.DEPTH_STENCIL_ATTACHMENT:J.DEPTH_ATTACHMENT,d=R.__webglDepthbuffer[s];J.bindRenderbuffer(J.RENDERBUFFER,d),J.framebufferRenderbuffer(J.FRAMEBUFFER,a,J.RENDERBUFFER,d)}}else{let s=B.texture.mipmaps;if(s&&s.length>0)$.bindFramebuffer(J.FRAMEBUFFER,R.__webglFramebuffer[0]);else $.bindFramebuffer(J.FRAMEBUFFER,R.__webglFramebuffer);if(R.__webglDepthbuffer===void 0)R.__webglDepthbuffer=J.createRenderbuffer(),S0(R.__webglDepthbuffer,B,!1);else{let a=B.stencilBuffer?J.DEPTH_STENCIL_ATTACHMENT:J.DEPTH_ATTACHMENT,d=R.__webglDepthbuffer;J.bindRenderbuffer(J.RENDERBUFFER,d),J.framebufferRenderbuffer(J.FRAMEBUFFER,a,J.RENDERBUFFER,d)}}$.bindFramebuffer(J.FRAMEBUFFER,null)}function I(B,R,f){let s=Z.get(B);if(R!==void 0)M0(s.__webglFramebuffer,B,B.texture,J.COLOR_ATTACHMENT0,J.TEXTURE_2D,0);if(f!==void 0)GJ(B)}function ZJ(B){let R=B.texture,f=Z.get(B),s=Z.get(R);B.addEventListener("dispose",S);let a=B.textures,d=B.isWebGLCubeRenderTarget===!0,N0=a.length>1;if(!N0){if(s.__webglTexture===void 0)s.__webglTexture=J.createTexture();s.__version=R.version,Y.memory.textures++}if(d){f.__webglFramebuffer=[];for(let Z0=0;Z0<6;Z0++)if(R.mipmaps&&R.mipmaps.length>0){f.__webglFramebuffer[Z0]=[];for(let D0=0;D0<R.mipmaps.length;D0++)f.__webglFramebuffer[Z0][D0]=J.createFramebuffer()}else f.__webglFramebuffer[Z0]=J.createFramebuffer()}else{if(R.mipmaps&&R.mipmaps.length>0){f.__webglFramebuffer=[];for(let Z0=0;Z0<R.mipmaps.length;Z0++)f.__webglFramebuffer[Z0]=J.createFramebuffer()}else f.__webglFramebuffer=J.createFramebuffer();if(N0)for(let Z0=0,D0=a.length;Z0<D0;Z0++){let y0=Z.get(a[Z0]);if(y0.__webglTexture===void 0)y0.__webglTexture=J.createTexture(),Y.memory.textures++}if(B.samples>0&&I0(B)===!1){f.__webglMultisampledFramebuffer=J.createFramebuffer(),f.__webglColorRenderbuffer=[],$.bindFramebuffer(J.FRAMEBUFFER,f.__webglMultisampledFramebuffer);for(let Z0=0;Z0<a.length;Z0++){let D0=a[Z0];f.__webglColorRenderbuffer[Z0]=J.createRenderbuffer(),J.bindRenderbuffer(J.RENDERBUFFER,f.__webglColorRenderbuffer[Z0]);let y0=H.convert(D0.format,D0.colorSpace),J0=H.convert(D0.type),G0=L(D0.internalFormat,y0,J0,D0.colorSpace,B.isXRRenderTarget===!0),L0=z0(B);J.renderbufferStorageMultisample(J.RENDERBUFFER,L0,G0,B.width,B.height),J.framebufferRenderbuffer(J.FRAMEBUFFER,J.COLOR_ATTACHMENT0+Z0,J.RENDERBUFFER,f.__webglColorRenderbuffer[Z0])}if(J.bindRenderbuffer(J.RENDERBUFFER,null),B.depthBuffer)f.__webglDepthRenderbuffer=J.createRenderbuffer(),S0(f.__webglDepthRenderbuffer,B,!0);$.bindFramebuffer(J.FRAMEBUFFER,null)}}if(d){$.bindTexture(J.TEXTURE_CUBE_MAP,s.__webglTexture),w0(J.TEXTURE_CUBE_MAP,R);for(let Z0=0;Z0<6;Z0++)if(R.mipmaps&&R.mipmaps.length>0)for(let D0=0;D0<R.mipmaps.length;D0++)M0(f.__webglFramebuffer[Z0][D0],B,R,J.COLOR_ATTACHMENT0,J.TEXTURE_CUBE_MAP_POSITIVE_X+Z0,D0);else M0(f.__webglFramebuffer[Z0],B,R,J.COLOR_ATTACHMENT0,J.TEXTURE_CUBE_MAP_POSITIVE_X+Z0,0);if(N(R))F(J.TEXTURE_CUBE_MAP);$.unbindTexture()}else if(N0){for(let Z0=0,D0=a.length;Z0<D0;Z0++){let y0=a[Z0],J0=Z.get(y0),G0=J.TEXTURE_2D;if(B.isWebGL3DRenderTarget||B.isWebGLArrayRenderTarget)G0=B.isWebGL3DRenderTarget?J.TEXTURE_3D:J.TEXTURE_2D_ARRAY;if($.bindTexture(G0,J0.__webglTexture),w0(G0,y0),M0(f.__webglFramebuffer,B,y0,J.COLOR_ATTACHMENT0+Z0,G0,0),N(y0))F(G0)}$.unbindTexture()}else{let Z0=J.TEXTURE_2D;if(B.isWebGL3DRenderTarget||B.isWebGLArrayRenderTarget)Z0=B.isWebGL3DRenderTarget?J.TEXTURE_3D:J.TEXTURE_2D_ARRAY;if($.bindTexture(Z0,s.__webglTexture),w0(Z0,R),R.mipmaps&&R.mipmaps.length>0)for(let D0=0;D0<R.mipmaps.length;D0++)M0(f.__webglFramebuffer[D0],B,R,J.COLOR_ATTACHMENT0,Z0,D0);else M0(f.__webglFramebuffer,B,R,J.COLOR_ATTACHMENT0,Z0,0);if(N(R))F(Z0);$.unbindTexture()}if(B.depthBuffer)GJ(B)}function x0(B){let R=B.textures;for(let f=0,s=R.length;f<s;f++){let a=R[f];if(N(a)){let d=C(B),N0=Z.get(a).__webglTexture;$.bindTexture(d,N0),F(d),$.unbindTexture()}}}let h0=[],k0=[];function qJ(B){if(B.samples>0){if(I0(B)===!1){let{textures:R,width:f,height:s}=B,a=J.COLOR_BUFFER_BIT,d=B.stencilBuffer?J.DEPTH_STENCIL_ATTACHMENT:J.DEPTH_ATTACHMENT,N0=Z.get(B),Z0=R.length>1;if(Z0)for(let y0=0;y0<R.length;y0++)$.bindFramebuffer(J.FRAMEBUFFER,N0.__webglMultisampledFramebuffer),J.framebufferRenderbuffer(J.FRAMEBUFFER,J.COLOR_ATTACHMENT0+y0,J.RENDERBUFFER,null),$.bindFramebuffer(J.FRAMEBUFFER,N0.__webglFramebuffer),J.framebufferTexture2D(J.DRAW_FRAMEBUFFER,J.COLOR_ATTACHMENT0+y0,J.TEXTURE_2D,null,0);$.bindFramebuffer(J.READ_FRAMEBUFFER,N0.__webglMultisampledFramebuffer);let D0=B.texture.mipmaps;if(D0&&D0.length>0)$.bindFramebuffer(J.DRAW_FRAMEBUFFER,N0.__webglFramebuffer[0]);else $.bindFramebuffer(J.DRAW_FRAMEBUFFER,N0.__webglFramebuffer);for(let y0=0;y0<R.length;y0++){if(B.resolveDepthBuffer){if(B.depthBuffer)a|=J.DEPTH_BUFFER_BIT;if(B.stencilBuffer&&B.resolveStencilBuffer)a|=J.STENCIL_BUFFER_BIT}if(Z0){J.framebufferRenderbuffer(J.READ_FRAMEBUFFER,J.COLOR_ATTACHMENT0,J.RENDERBUFFER,N0.__webglColorRenderbuffer[y0]);let J0=Z.get(R[y0]).__webglTexture;J.framebufferTexture2D(J.DRAW_FRAMEBUFFER,J.COLOR_ATTACHMENT0,J.TEXTURE_2D,J0,0)}if(J.blitFramebuffer(0,0,f,s,0,0,f,s,a,J.NEAREST),K===!0){if(h0.length=0,k0.length=0,h0.push(J.COLOR_ATTACHMENT0+y0),B.depthBuffer&&B.resolveDepthBuffer===!1)h0.push(d),k0.push(d),J.invalidateFramebuffer(J.DRAW_FRAMEBUFFER,k0);J.invalidateFramebuffer(J.READ_FRAMEBUFFER,h0)}}if($.bindFramebuffer(J.READ_FRAMEBUFFER,null),$.bindFramebuffer(J.DRAW_FRAMEBUFFER,null),Z0)for(let y0=0;y0<R.length;y0++){$.bindFramebuffer(J.FRAMEBUFFER,N0.__webglMultisampledFramebuffer),J.framebufferRenderbuffer(J.FRAMEBUFFER,J.COLOR_ATTACHMENT0+y0,J.RENDERBUFFER,N0.__webglColorRenderbuffer[y0]);let J0=Z.get(R[y0]).__webglTexture;$.bindFramebuffer(J.FRAMEBUFFER,N0.__webglFramebuffer),J.framebufferTexture2D(J.DRAW_FRAMEBUFFER,J.COLOR_ATTACHMENT0+y0,J.TEXTURE_2D,J0,0)}$.bindFramebuffer(J.DRAW_FRAMEBUFFER,N0.__webglMultisampledFramebuffer)}else if(B.depthBuffer&&B.resolveDepthBuffer===!1&&K){let R=B.stencilBuffer?J.DEPTH_STENCIL_ATTACHMENT:J.DEPTH_ATTACHMENT;J.invalidateFramebuffer(J.DRAW_FRAMEBUFFER,[R])}}}function z0(B){return Math.min(W.maxSamples,B.samples)}function I0(B){let R=Z.get(B);return B.samples>0&&Q.has("WEBGL_multisampled_render_to_texture")===!0&&R.__useRenderToTexture!==!1}function PJ(B){let R=Y.render.frame;if(G.get(B)!==R)G.set(B,R),B.update()}function CJ(B,R){let{colorSpace:f,format:s,type:a}=B;if(B.isCompressedTexture===!0||B.isVideoTexture===!0)return R;if(f!==hJ&&f!==D9)if(n0.getTransfer(f)===XJ){if(s!==V8||a!==r8)console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.")}else console.error("THREE.WebGLTextures: Unsupported texture color space:",f);return R}function RJ(B){if(typeof HTMLImageElement<"u"&&B instanceof HTMLImageElement)U.width=B.naturalWidth||B.width,U.height=B.naturalHeight||B.height;else if(typeof VideoFrame<"u"&&B instanceof VideoFrame)U.width=B.displayWidth,U.height=B.displayHeight;else U.width=B.width,U.height=B.height;return U}this.allocateTextureUnit=c,this.resetTextureUnits=m,this.setTexture2D=i,this.setTexture2DArray=u,this.setTexture3D=r,this.setTextureCube=b,this.rebindTextures=I,this.setupRenderTarget=ZJ,this.updateRenderTargetMipmap=x0,this.updateMultisampleRenderTarget=qJ,this.setupDepthRenderbuffer=GJ,this.setupFrameBufferTexture=M0,this.useMultisampledRTT=I0}function Mq(J,Q){function $(Z,W=D9){let H,Y=n0.getTransfer(W);if(Z===r8)return J.UNSIGNED_BYTE;if(Z===J$)return J.UNSIGNED_SHORT_4_4_4_4;if(Z===Q$)return J.UNSIGNED_SHORT_5_5_5_1;if(Z===aW)return J.UNSIGNED_INT_5_9_9_9_REV;if(Z===rW)return J.UNSIGNED_INT_10F_11F_11F_REV;if(Z===oW)return J.BYTE;if(Z===iW)return J.SHORT;if(Z===w6)return J.UNSIGNED_SHORT;if(Z===eQ)return J.INT;if(Z===e9)return J.UNSIGNED_INT;if(Z===t8)return J.FLOAT;if(Z===I6)return J.HALF_FLOAT;if(Z===tW)return J.ALPHA;if(Z===eW)return J.RGB;if(Z===V8)return J.RGBA;if(Z===S7)return J.DEPTH_COMPONENT;if(Z===P6)return J.DEPTH_STENCIL;if(Z===JH)return J.RED;if(Z===$$)return J.RED_INTEGER;if(Z===QH)return J.RG;if(Z===Z$)return J.RG_INTEGER;if(Z===W$)return J.RGBA_INTEGER;if(Z===j7||Z===y7||Z===v7||Z===f7)if(Y===XJ)if(H=Q.get("WEBGL_compressed_texture_s3tc_srgb"),H!==null){if(Z===j7)return H.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(Z===y7)return H.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(Z===v7)return H.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(Z===f7)return H.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(H=Q.get("WEBGL_compressed_texture_s3tc"),H!==null){if(Z===j7)return H.COMPRESSED_RGB_S3TC_DXT1_EXT;if(Z===y7)return H.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(Z===v7)return H.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(Z===f7)return H.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(Z===H$||Z===Y$||Z===X$||Z===K$)if(H=Q.get("WEBGL_compressed_texture_pvrtc"),H!==null){if(Z===H$)return H.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(Z===Y$)return H.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(Z===X$)return H.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(Z===K$)return H.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(Z===U$||Z===G$||Z===q$)if(H=Q.get("WEBGL_compressed_texture_etc"),H!==null){if(Z===U$||Z===G$)return Y===XJ?H.COMPRESSED_SRGB8_ETC2:H.COMPRESSED_RGB8_ETC2;if(Z===q$)return Y===XJ?H.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:H.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(Z===E$||Z===N$||Z===F$||Z===O$||Z===R$||Z===k$||Z===D$||Z===M$||Z===L$||Z===V$||Z===z$||Z===B$||Z===C$||Z===_$)if(H=Q.get("WEBGL_compressed_texture_astc"),H!==null){if(Z===E$)return Y===XJ?H.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:H.COMPRESSED_RGBA_ASTC_4x4_KHR;if(Z===N$)return Y===XJ?H.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:H.COMPRESSED_RGBA_ASTC_5x4_KHR;if(Z===F$)return Y===XJ?H.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:H.COMPRESSED_RGBA_ASTC_5x5_KHR;if(Z===O$)return Y===XJ?H.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:H.COMPRESSED_RGBA_ASTC_6x5_KHR;if(Z===R$)return Y===XJ?H.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:H.COMPRESSED_RGBA_ASTC_6x6_KHR;if(Z===k$)return Y===XJ?H.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:H.COMPRESSED_RGBA_ASTC_8x5_KHR;if(Z===D$)return Y===XJ?H.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:H.COMPRESSED_RGBA_ASTC_8x6_KHR;if(Z===M$)return Y===XJ?H.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:H.COMPRESSED_RGBA_ASTC_8x8_KHR;if(Z===L$)return Y===XJ?H.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:H.COMPRESSED_RGBA_ASTC_10x5_KHR;if(Z===V$)return Y===XJ?H.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:H.COMPRESSED_RGBA_ASTC_10x6_KHR;if(Z===z$)return Y===XJ?H.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:H.COMPRESSED_RGBA_ASTC_10x8_KHR;if(Z===B$)return Y===XJ?H.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:H.COMPRESSED_RGBA_ASTC_10x10_KHR;if(Z===C$)return Y===XJ?H.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:H.COMPRESSED_RGBA_ASTC_12x10_KHR;if(Z===_$)return Y===XJ?H.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:H.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(Z===w$||Z===I$||Z===P$)if(H=Q.get("EXT_texture_compression_bptc"),H!==null){if(Z===w$)return Y===XJ?H.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:H.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(Z===I$)return H.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(Z===P$)return H.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(Z===T$||Z===A$||Z===S$||Z===j$)if(H=Q.get("EXT_texture_compression_rgtc"),H!==null){if(Z===T$)return H.COMPRESSED_RED_RGTC1_EXT;if(Z===A$)return H.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(Z===S$)return H.COMPRESSED_RED_GREEN_RGTC2_EXT;if(Z===j$)return H.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;if(Z===J6)return J.UNSIGNED_INT_24_8;return J[Z]!==void 0?J[Z]:null}return{convert:$}}var Lq=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Vq=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class $Y{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(J,Q){if(this.texture===null){let $=new r7(J.texture);if(J.depthNear!==Q.depthNear||J.depthFar!==Q.depthFar)this.depthNear=J.depthNear,this.depthFar=J.depthFar;this.texture=$}}getMesh(J){if(this.texture!==null){if(this.mesh===null){let Q=J.cameras[0].viewport,$=new z8({vertexShader:Lq,fragmentShader:Vq,uniforms:{depthColor:{value:this.texture},depthWidth:{value:Q.z},depthHeight:{value:Q.w}}});this.mesh=new IJ(new L9(20,20),$)}}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class ZY extends x8{constructor(J,Q){super();let $=this,Z=null,W=1,H=null,Y="local-floor",X=1,K=null,U=null,G=null,q=null,E=null,O=null,D=typeof XRWebGLBinding<"u",k=new $Y,N={},F=Q.getContextAttributes(),C=null,L=null,_=[],j=[],w=new _0,S=null,p=new TJ;p.viewport=new a0;let z=new TJ;z.viewport=new a0;let V=[p,z],A=new QZ,m=null,c=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(n){let W0=_[n];if(W0===void 0)W0=new j6,_[n]=W0;return W0.getTargetRaySpace()},this.getControllerGrip=function(n){let W0=_[n];if(W0===void 0)W0=new j6,_[n]=W0;return W0.getGripSpace()},this.getHand=function(n){let W0=_[n];if(W0===void 0)W0=new j6,_[n]=W0;return W0.getHandSpace()};function l(n){let W0=j.indexOf(n.inputSource);if(W0===-1)return;let Q0=_[W0];if(Q0!==void 0)Q0.update(n.inputSource,n.frame,K||H),Q0.dispatchEvent({type:n.type,data:n.inputSource})}function i(){Z.removeEventListener("select",l),Z.removeEventListener("selectstart",l),Z.removeEventListener("selectend",l),Z.removeEventListener("squeeze",l),Z.removeEventListener("squeezestart",l),Z.removeEventListener("squeezeend",l),Z.removeEventListener("end",i),Z.removeEventListener("inputsourceschange",u);for(let n=0;n<_.length;n++){let W0=j[n];if(W0===null)continue;j[n]=null,_[n].disconnect(W0)}m=null,c=null,k.reset();for(let n in N)delete N[n];J.setRenderTarget(C),E=null,q=null,G=null,Z=null,L=null,s0.stop(),$.isPresenting=!1,J.setPixelRatio(S),J.setSize(w.width,w.height,!1),$.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(n){if(W=n,$.isPresenting===!0)console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(n){if(Y=n,$.isPresenting===!0)console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return K||H},this.setReferenceSpace=function(n){K=n},this.getBaseLayer=function(){return q!==null?q:E},this.getBinding=function(){if(G===null&&D)G=new XRWebGLBinding(Z,Q);return G},this.getFrame=function(){return O},this.getSession=function(){return Z},this.setSession=async function(n){if(Z=n,Z!==null){if(C=J.getRenderTarget(),Z.addEventListener("select",l),Z.addEventListener("selectstart",l),Z.addEventListener("selectend",l),Z.addEventListener("squeeze",l),Z.addEventListener("squeezestart",l),Z.addEventListener("squeezeend",l),Z.addEventListener("end",i),Z.addEventListener("inputsourceschange",u),F.xrCompatible!==!0)await Q.makeXRCompatible();if(S=J.getPixelRatio(),J.getSize(w),!(D&&("createProjectionLayer"in XRWebGLBinding.prototype))){let Q0={antialias:F.antialias,alpha:!0,depth:F.depth,stencil:F.stencil,framebufferScaleFactor:W};E=new XRWebGLLayer(Z,Q,Q0),Z.updateRenderState({baseLayer:E}),J.setPixelRatio(1),J.setSize(E.framebufferWidth,E.framebufferHeight,!1),L=new b8(E.framebufferWidth,E.framebufferHeight,{format:V8,type:r8,colorSpace:J.outputColorSpace,stencilBuffer:F.stencil,resolveDepthBuffer:E.ignoreDepthValues===!1,resolveStencilBuffer:E.ignoreDepthValues===!1})}else{let Q0=null,M0=null,S0=null;if(F.depth)S0=F.stencil?Q.DEPTH24_STENCIL8:Q.DEPTH_COMPONENT24,Q0=F.stencil?P6:S7,M0=F.stencil?J6:e9;let T0={colorFormat:Q.RGBA8,depthFormat:S0,scaleFactor:W};G=this.getBinding(),q=G.createProjectionLayer(T0),Z.updateRenderState({layers:[q]}),J.setPixelRatio(1),J.setSize(q.textureWidth,q.textureHeight,!1),L=new b8(q.textureWidth,q.textureHeight,{format:V8,type:r8,depthTexture:new a7(q.textureWidth,q.textureHeight,M0,void 0,void 0,void 0,void 0,void 0,void 0,Q0),stencilBuffer:F.stencil,colorSpace:J.outputColorSpace,samples:F.antialias?4:0,resolveDepthBuffer:q.ignoreDepthValues===!1,resolveStencilBuffer:q.ignoreDepthValues===!1})}L.isXRRenderTarget=!0,this.setFoveation(X),K=null,H=await Z.requestReferenceSpace(Y),s0.setContext(Z),s0.start(),$.isPresenting=!0,$.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(Z!==null)return Z.environmentBlendMode},this.getDepthTexture=function(){return k.getDepthTexture()};function u(n){for(let W0=0;W0<n.removed.length;W0++){let Q0=n.removed[W0],M0=j.indexOf(Q0);if(M0>=0)j[M0]=null,_[M0].disconnect(Q0)}for(let W0=0;W0<n.added.length;W0++){let Q0=n.added[W0],M0=j.indexOf(Q0);if(M0===-1){for(let T0=0;T0<_.length;T0++)if(T0>=j.length){j.push(Q0),M0=T0;break}else if(j[T0]===null){j[T0]=Q0,M0=T0;break}if(M0===-1)break}let S0=_[M0];if(S0)S0.connect(Q0)}}let r=new P,b=new P;function X0(n,W0,Q0){r.setFromMatrixPosition(W0.matrixWorld),b.setFromMatrixPosition(Q0.matrixWorld);let M0=r.distanceTo(b),S0=W0.projectionMatrix.elements,T0=Q0.projectionMatrix.elements,GJ=S0[14]/(S0[10]-1),I=S0[14]/(S0[10]+1),ZJ=(S0[9]+1)/S0[5],x0=(S0[9]-1)/S0[5],h0=(S0[8]-1)/S0[0],k0=(T0[8]+1)/T0[0],qJ=GJ*h0,z0=GJ*k0,I0=M0/(-h0+k0),PJ=I0*-h0;if(W0.matrixWorld.decompose(n.position,n.quaternion,n.scale),n.translateX(PJ),n.translateZ(I0),n.matrixWorld.compose(n.position,n.quaternion,n.scale),n.matrixWorldInverse.copy(n.matrixWorld).invert(),S0[10]===-1)n.projectionMatrix.copy(W0.projectionMatrix),n.projectionMatrixInverse.copy(W0.projectionMatrixInverse);else{let CJ=GJ+I0,RJ=I+I0,B=qJ-PJ,R=z0+(M0-PJ),f=ZJ*I/RJ*CJ,s=x0*I/RJ*CJ;n.projectionMatrix.makePerspective(B,R,f,s,CJ,RJ),n.projectionMatrixInverse.copy(n.projectionMatrix).invert()}}function g(n,W0){if(W0===null)n.matrixWorld.copy(n.matrix);else n.matrixWorld.multiplyMatrices(W0.matrixWorld,n.matrix);n.matrixWorldInverse.copy(n.matrixWorld).invert()}this.updateCamera=function(n){if(Z===null)return;let{near:W0,far:Q0}=n;if(k.texture!==null){if(k.depthNear>0)W0=k.depthNear;if(k.depthFar>0)Q0=k.depthFar}if(A.near=z.near=p.near=W0,A.far=z.far=p.far=Q0,m!==A.near||c!==A.far)Z.updateRenderState({depthNear:A.near,depthFar:A.far}),m=A.near,c=A.far;A.layers.mask=n.layers.mask|6,p.layers.mask=A.layers.mask&3,z.layers.mask=A.layers.mask&5;let M0=n.parent,S0=A.cameras;g(A,M0);for(let T0=0;T0<S0.length;T0++)g(S0[T0],M0);if(S0.length===2)X0(A,p,z);else A.projectionMatrix.copy(p.projectionMatrix);$0(n,A,M0)};function $0(n,W0,Q0){if(Q0===null)n.matrix.copy(W0.matrixWorld);else n.matrix.copy(Q0.matrixWorld),n.matrix.invert(),n.matrix.multiply(W0.matrixWorld);if(n.matrix.decompose(n.position,n.quaternion,n.scale),n.updateMatrixWorld(!0),n.projectionMatrix.copy(W0.projectionMatrix),n.projectionMatrixInverse.copy(W0.projectionMatrixInverse),n.isPerspectiveCamera)n.fov=F9*2*Math.atan(1/n.projectionMatrix.elements[5]),n.zoom=1}this.getCamera=function(){return A},this.getFoveation=function(){if(q===null&&E===null)return;return X},this.setFoveation=function(n){if(X=n,q!==null)q.fixedFoveation=n;if(E!==null&&E.fixedFoveation!==void 0)E.fixedFoveation=n},this.hasDepthSensing=function(){return k.texture!==null},this.getDepthSensingMesh=function(){return k.getMesh(A)},this.getCameraTexture=function(n){return N[n]};let w0=null;function u0(n,W0){if(U=W0.getViewerPose(K||H),O=W0,U!==null){let Q0=U.views;if(E!==null)J.setRenderTargetFramebuffer(L,E.framebuffer),J.setRenderTarget(L);let M0=!1;if(Q0.length!==A.cameras.length)A.cameras.length=0,M0=!0;for(let I=0;I<Q0.length;I++){let ZJ=Q0[I],x0=null;if(E!==null)x0=E.getViewport(ZJ);else{let k0=G.getViewSubImage(q,ZJ);if(x0=k0.viewport,I===0)J.setRenderTargetTextures(L,k0.colorTexture,k0.depthStencilTexture),J.setRenderTarget(L)}let h0=V[I];if(h0===void 0)h0=new TJ,h0.layers.enable(I),h0.viewport=new a0,V[I]=h0;if(h0.matrix.fromArray(ZJ.transform.matrix),h0.matrix.decompose(h0.position,h0.quaternion,h0.scale),h0.projectionMatrix.fromArray(ZJ.projectionMatrix),h0.projectionMatrixInverse.copy(h0.projectionMatrix).invert(),h0.viewport.set(x0.x,x0.y,x0.width,x0.height),I===0)A.matrix.copy(h0.matrix),A.matrix.decompose(A.position,A.quaternion,A.scale);if(M0===!0)A.cameras.push(h0)}let S0=Z.enabledFeatures;if(S0&&S0.includes("depth-sensing")&&Z.depthUsage=="gpu-optimized"&&D){G=$.getBinding();let I=G.getDepthInformation(Q0[0]);if(I&&I.isValid&&I.texture)k.init(I,Z.renderState)}if(S0&&S0.includes("camera-access")&&D){J.state.unbindTexture(),G=$.getBinding();for(let I=0;I<Q0.length;I++){let ZJ=Q0[I].camera;if(ZJ){let x0=N[ZJ];if(!x0)x0=new r7,N[ZJ]=x0;let h0=G.getCameraImage(ZJ);x0.sourceTexture=h0}}}}for(let Q0=0;Q0<_.length;Q0++){let M0=j[Q0],S0=_[Q0];if(M0!==null&&S0!==void 0)S0.update(M0,W0,K||H)}if(w0)w0(n,W0);if(W0.detectedPlanes)$.dispatchEvent({type:"planesdetected",data:W0});O=null}let s0=new nH;s0.setAnimationLoop(u0),this.setAnimationLoop=function(n){w0=n},this.dispose=function(){}}}var C9=new q8,zq=new j0;function Bq(J,Q){function $(N,F){if(N.matrixAutoUpdate===!0)N.updateMatrix();F.value.copy(N.matrix)}function Z(N,F){if(F.color.getRGB(N.fogColor.value,u$(J)),F.isFog)N.fogNear.value=F.near,N.fogFar.value=F.far;else if(F.isFogExp2)N.fogDensity.value=F.density}function W(N,F,C,L,_){if(F.isMeshBasicMaterial)H(N,F);else if(F.isMeshLambertMaterial)H(N,F);else if(F.isMeshToonMaterial)H(N,F),q(N,F);else if(F.isMeshPhongMaterial)H(N,F),G(N,F);else if(F.isMeshStandardMaterial){if(H(N,F),E(N,F),F.isMeshPhysicalMaterial)O(N,F,_)}else if(F.isMeshMatcapMaterial)H(N,F),D(N,F);else if(F.isMeshDepthMaterial)H(N,F);else if(F.isMeshDistanceMaterial)H(N,F),k(N,F);else if(F.isMeshNormalMaterial)H(N,F);else if(F.isLineBasicMaterial){if(Y(N,F),F.isLineDashedMaterial)X(N,F)}else if(F.isPointsMaterial)K(N,F,C,L);else if(F.isSpriteMaterial)U(N,F);else if(F.isShadowMaterial)N.color.value.copy(F.color),N.opacity.value=F.opacity;else if(F.isShaderMaterial)F.uniformsNeedUpdate=!1}function H(N,F){if(N.opacity.value=F.opacity,F.color)N.diffuse.value.copy(F.color);if(F.emissive)N.emissive.value.copy(F.emissive).multiplyScalar(F.emissiveIntensity);if(F.map)N.map.value=F.map,$(F.map,N.mapTransform);if(F.alphaMap)N.alphaMap.value=F.alphaMap,$(F.alphaMap,N.alphaMapTransform);if(F.bumpMap){if(N.bumpMap.value=F.bumpMap,$(F.bumpMap,N.bumpMapTransform),N.bumpScale.value=F.bumpScale,F.side===uJ)N.bumpScale.value*=-1}if(F.normalMap){if(N.normalMap.value=F.normalMap,$(F.normalMap,N.normalMapTransform),N.normalScale.value.copy(F.normalScale),F.side===uJ)N.normalScale.value.negate()}if(F.displacementMap)N.displacementMap.value=F.displacementMap,$(F.displacementMap,N.displacementMapTransform),N.displacementScale.value=F.displacementScale,N.displacementBias.value=F.displacementBias;if(F.emissiveMap)N.emissiveMap.value=F.emissiveMap,$(F.emissiveMap,N.emissiveMapTransform);if(F.specularMap)N.specularMap.value=F.specularMap,$(F.specularMap,N.specularMapTransform);if(F.alphaTest>0)N.alphaTest.value=F.alphaTest;let C=Q.get(F),L=C.envMap,_=C.envMapRotation;if(L){if(N.envMap.value=L,C9.copy(_),C9.x*=-1,C9.y*=-1,C9.z*=-1,L.isCubeTexture&&L.isRenderTargetTexture===!1)C9.y*=-1,C9.z*=-1;N.envMapRotation.value.setFromMatrix4(zq.makeRotationFromEuler(C9)),N.flipEnvMap.value=L.isCubeTexture&&L.isRenderTargetTexture===!1?-1:1,N.reflectivity.value=F.reflectivity,N.ior.value=F.ior,N.refractionRatio.value=F.refractionRatio}if(F.lightMap)N.lightMap.value=F.lightMap,N.lightMapIntensity.value=F.lightMapIntensity,$(F.lightMap,N.lightMapTransform);if(F.aoMap)N.aoMap.value=F.aoMap,N.aoMapIntensity.value=F.aoMapIntensity,$(F.aoMap,N.aoMapTransform)}function Y(N,F){if(N.diffuse.value.copy(F.color),N.opacity.value=F.opacity,F.map)N.map.value=F.map,$(F.map,N.mapTransform)}function X(N,F){N.dashSize.value=F.dashSize,N.totalSize.value=F.dashSize+F.gapSize,N.scale.value=F.scale}function K(N,F,C,L){if(N.diffuse.value.copy(F.color),N.opacity.value=F.opacity,N.size.value=F.size*C,N.scale.value=L*0.5,F.map)N.map.value=F.map,$(F.map,N.uvTransform);if(F.alphaMap)N.alphaMap.value=F.alphaMap,$(F.alphaMap,N.alphaMapTransform);if(F.alphaTest>0)N.alphaTest.value=F.alphaTest}function U(N,F){if(N.diffuse.value.copy(F.color),N.opacity.value=F.opacity,N.rotation.value=F.rotation,F.map)N.map.value=F.map,$(F.map,N.mapTransform);if(F.alphaMap)N.alphaMap.value=F.alphaMap,$(F.alphaMap,N.alphaMapTransform);if(F.alphaTest>0)N.alphaTest.value=F.alphaTest}function G(N,F){N.specular.value.copy(F.specular),N.shininess.value=Math.max(F.shininess,0.0001)}function q(N,F){if(F.gradientMap)N.gradientMap.value=F.gradientMap}function E(N,F){if(N.metalness.value=F.metalness,F.metalnessMap)N.metalnessMap.value=F.metalnessMap,$(F.metalnessMap,N.metalnessMapTransform);if(N.roughness.value=F.roughness,F.roughnessMap)N.roughnessMap.value=F.roughnessMap,$(F.roughnessMap,N.roughnessMapTransform);if(F.envMap)N.envMapIntensity.value=F.envMapIntensity}function O(N,F,C){if(N.ior.value=F.ior,F.sheen>0){if(N.sheenColor.value.copy(F.sheenColor).multiplyScalar(F.sheen),N.sheenRoughness.value=F.sheenRoughness,F.sheenColorMap)N.sheenColorMap.value=F.sheenColorMap,$(F.sheenColorMap,N.sheenColorMapTransform);if(F.sheenRoughnessMap)N.sheenRoughnessMap.value=F.sheenRoughnessMap,$(F.sheenRoughnessMap,N.sheenRoughnessMapTransform)}if(F.clearcoat>0){if(N.clearcoat.value=F.clearcoat,N.clearcoatRoughness.value=F.clearcoatRoughness,F.clearcoatMap)N.clearcoatMap.value=F.clearcoatMap,$(F.clearcoatMap,N.clearcoatMapTransform);if(F.clearcoatRoughnessMap)N.clearcoatRoughnessMap.value=F.clearcoatRoughnessMap,$(F.clearcoatRoughnessMap,N.clearcoatRoughnessMapTransform);if(F.clearcoatNormalMap){if(N.clearcoatNormalMap.value=F.clearcoatNormalMap,$(F.clearcoatNormalMap,N.clearcoatNormalMapTransform),N.clearcoatNormalScale.value.copy(F.clearcoatNormalScale),F.side===uJ)N.clearcoatNormalScale.value.negate()}}if(F.dispersion>0)N.dispersion.value=F.dispersion;if(F.iridescence>0){if(N.iridescence.value=F.iridescence,N.iridescenceIOR.value=F.iridescenceIOR,N.iridescenceThicknessMinimum.value=F.iridescenceThicknessRange[0],N.iridescenceThicknessMaximum.value=F.iridescenceThicknessRange[1],F.iridescenceMap)N.iridescenceMap.value=F.iridescenceMap,$(F.iridescenceMap,N.iridescenceMapTransform);if(F.iridescenceThicknessMap)N.iridescenceThicknessMap.value=F.iridescenceThicknessMap,$(F.iridescenceThicknessMap,N.iridescenceThicknessMapTransform)}if(F.transmission>0){if(N.transmission.value=F.transmission,N.transmissionSamplerMap.value=C.texture,N.transmissionSamplerSize.value.set(C.width,C.height),F.transmissionMap)N.transmissionMap.value=F.transmissionMap,$(F.transmissionMap,N.transmissionMapTransform);if(N.thickness.value=F.thickness,F.thicknessMap)N.thicknessMap.value=F.thicknessMap,$(F.thicknessMap,N.thicknessMapTransform);N.attenuationDistance.value=F.attenuationDistance,N.attenuationColor.value.copy(F.attenuationColor)}if(F.anisotropy>0){if(N.anisotropyVector.value.set(F.anisotropy*Math.cos(F.anisotropyRotation),F.anisotropy*Math.sin(F.anisotropyRotation)),F.anisotropyMap)N.anisotropyMap.value=F.anisotropyMap,$(F.anisotropyMap,N.anisotropyMapTransform)}if(N.specularIntensity.value=F.specularIntensity,N.specularColor.value.copy(F.specularColor),F.specularColorMap)N.specularColorMap.value=F.specularColorMap,$(F.specularColorMap,N.specularColorMapTransform);if(F.specularIntensityMap)N.specularIntensityMap.value=F.specularIntensityMap,$(F.specularIntensityMap,N.specularIntensityMapTransform)}function D(N,F){if(F.matcap)N.matcap.value=F.matcap}function k(N,F){let C=Q.get(F).light;N.referencePosition.value.setFromMatrixPosition(C.matrixWorld),N.nearDistance.value=C.shadow.camera.near,N.farDistance.value=C.shadow.camera.far}return{refreshFogUniforms:Z,refreshMaterialUniforms:W}}function Cq(J,Q,$,Z){let W={},H={},Y=[],X=J.getParameter(J.MAX_UNIFORM_BUFFER_BINDINGS);function K(C,L){let _=L.program;Z.uniformBlockBinding(C,_)}function U(C,L){let _=W[C.id];if(_===void 0)D(C),_=G(C),W[C.id]=_,C.addEventListener("dispose",N);let j=L.program;Z.updateUBOMapping(C,j);let w=Q.render.frame;if(H[C.id]!==w)E(C),H[C.id]=w}function G(C){let L=q();C.__bindingPointIndex=L;let _=J.createBuffer(),j=C.__size,w=C.usage;return J.bindBuffer(J.UNIFORM_BUFFER,_),J.bufferData(J.UNIFORM_BUFFER,j,w),J.bindBuffer(J.UNIFORM_BUFFER,null),J.bindBufferBase(J.UNIFORM_BUFFER,L,_),_}function q(){for(let C=0;C<X;C++)if(Y.indexOf(C)===-1)return Y.push(C),C;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function E(C){let L=W[C.id],_=C.uniforms,j=C.__cache;J.bindBuffer(J.UNIFORM_BUFFER,L);for(let w=0,S=_.length;w<S;w++){let p=Array.isArray(_[w])?_[w]:[_[w]];for(let z=0,V=p.length;z<V;z++){let A=p[z];if(O(A,w,z,j)===!0){let m=A.__offset,c=Array.isArray(A.value)?A.value:[A.value],l=0;for(let i=0;i<c.length;i++){let u=c[i],r=k(u);if(typeof u==="number"||typeof u==="boolean")A.__data[0]=u,J.bufferSubData(J.UNIFORM_BUFFER,m+l,A.__data);else if(u.isMatrix3)A.__data[0]=u.elements[0],A.__data[1]=u.elements[1],A.__data[2]=u.elements[2],A.__data[3]=0,A.__data[4]=u.elements[3],A.__data[5]=u.elements[4],A.__data[6]=u.elements[5],A.__data[7]=0,A.__data[8]=u.elements[6],A.__data[9]=u.elements[7],A.__data[10]=u.elements[8],A.__data[11]=0;else u.toArray(A.__data,l),l+=r.storage/Float32Array.BYTES_PER_ELEMENT}J.bufferSubData(J.UNIFORM_BUFFER,m,A.__data)}}}J.bindBuffer(J.UNIFORM_BUFFER,null)}function O(C,L,_,j){let w=C.value,S=L+"_"+_;if(j[S]===void 0){if(typeof w==="number"||typeof w==="boolean")j[S]=w;else j[S]=w.clone();return!0}else{let p=j[S];if(typeof w==="number"||typeof w==="boolean"){if(p!==w)return j[S]=w,!0}else if(p.equals(w)===!1)return p.copy(w),!0}return!1}function D(C){let L=C.uniforms,_=0,j=16;for(let S=0,p=L.length;S<p;S++){let z=Array.isArray(L[S])?L[S]:[L[S]];for(let V=0,A=z.length;V<A;V++){let m=z[V],c=Array.isArray(m.value)?m.value:[m.value];for(let l=0,i=c.length;l<i;l++){let u=c[l],r=k(u),b=_%j,X0=b%r.boundary,g=b+X0;if(_+=X0,g!==0&&j-g<r.storage)_+=j-g;m.__data=new Float32Array(r.storage/Float32Array.BYTES_PER_ELEMENT),m.__offset=_,_+=r.storage}}}let w=_%j;if(w>0)_+=j-w;return C.__size=_,C.__cache={},this}function k(C){let L={boundary:0,storage:0};if(typeof C==="number"||typeof C==="boolean")L.boundary=4,L.storage=4;else if(C.isVector2)L.boundary=8,L.storage=8;else if(C.isVector3||C.isColor)L.boundary=16,L.storage=12;else if(C.isVector4)L.boundary=16,L.storage=16;else if(C.isMatrix3)L.boundary=48,L.storage=48;else if(C.isMatrix4)L.boundary=64,L.storage=64;else if(C.isTexture)console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group.");else console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",C);return L}function N(C){let L=C.target;L.removeEventListener("dispose",N);let _=Y.indexOf(L.__bindingPointIndex);Y.splice(_,1),J.deleteBuffer(W[L.id]),delete W[L.id],delete H[L.id]}function F(){for(let C in W)J.deleteBuffer(W[C]);Y=[],W={},H={}}return{bind:K,update:U,dispose:F}}class FZ{constructor(J={}){let{canvas:Q=EH(),context:$=null,depth:Z=!0,stencil:W=!1,alpha:H=!1,antialias:Y=!1,premultipliedAlpha:X=!0,preserveDrawingBuffer:K=!1,powerPreference:U="default",failIfMajorPerformanceCaveat:G=!1,reversedDepthBuffer:q=!1}=J;this.isWebGLRenderer=!0;let E;if($!==null){if(typeof WebGLRenderingContext<"u"&&$ instanceof WebGLRenderingContext)throw Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");E=$.getContextAttributes().alpha}else E=H;let O=new Uint32Array(4),D=new Int32Array(4),k=null,N=null,F=[],C=[];this.domElement=Q,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=v8,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let L=this,_=!1;this._outputColorSpace=N8;let j=0,w=0,S=null,p=-1,z=null,V=new a0,A=new a0,m=null,c=new P0(0),l=0,i=Q.width,u=Q.height,r=1,b=null,X0=null,g=new a0(0,0,i,u),$0=new a0(0,0,i,u),w0=!1,u0=new h6,s0=!1,n=!1,W0=new j0,Q0=new P,M0=new a0,S0={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},T0=!1;function GJ(){return S===null?r:1}let I=$;function ZJ(M,y){return Q.getContext(M,y)}try{let M={alpha:!0,depth:Z,stencil:W,antialias:Y,premultipliedAlpha:X,preserveDrawingBuffer:K,powerPreference:U,failIfMajorPerformanceCaveat:G};if("setAttribute"in Q)Q.setAttribute("data-engine",`three.js r${RW}`);if(Q.addEventListener("webglcontextlost",K0,!1),Q.addEventListener("webglcontextrestored",H0,!1),Q.addEventListener("webglcontextcreationerror",F0,!1),I===null){if(I=ZJ("webgl2",M),I===null)if(ZJ("webgl2"))throw Error("Error creating WebGL context with your selected attributes.");else throw Error("Error creating WebGL context.")}}catch(M){throw console.error("THREE.WebGLRenderer: "+M.message),M}let x0,h0,k0,qJ,z0,I0,PJ,CJ,RJ,B,R,f,s,a,d,N0,Z0,D0,y0,J0,G0,L0,V0,q0;function l0(){if(x0=new dG(I),x0.init(),L0=new Mq(I,x0),h0=new fG(I,x0,J,L0),k0=new kq(I,x0),h0.reversedDepthBuffer&&q)k0.buffers.depth.setReversed(!0);qJ=new cG(I),z0=new Wq,I0=new Dq(I,x0,k0,z0,h0,L0,qJ),PJ=new xG(L),CJ=new lG(L),RJ=new rX(I),V0=new yG(I,RJ),B=new mG(I,RJ,qJ,V0),R=new sG(I,B,RJ,qJ),y0=new nG(I,h0,I0),N0=new hG(z0),f=new Zq(L,PJ,CJ,x0,h0,V0,N0),s=new Bq(L,z0),a=new Yq,d=new Eq(x0),D0=new jG(L,PJ,CJ,k0,R,E,X),Z0=new Oq(L,R,h0),q0=new Cq(I,qJ,h0,k0),J0=new vG(I,x0,qJ),G0=new uG(I,x0,qJ),qJ.programs=f.programs,L.capabilities=h0,L.extensions=x0,L.properties=z0,L.renderLists=a,L.shadowMap=Z0,L.state=k0,L.info=qJ}l0();let T=new ZY(L,I);this.xr=T,this.getContext=function(){return I},this.getContextAttributes=function(){return I.getContextAttributes()},this.forceContextLoss=function(){let M=x0.get("WEBGL_lose_context");if(M)M.loseContext()},this.forceContextRestore=function(){let M=x0.get("WEBGL_lose_context");if(M)M.restoreContext()},this.getPixelRatio=function(){return r},this.setPixelRatio=function(M){if(M===void 0)return;r=M,this.setSize(i,u,!1)},this.getSize=function(M){return M.set(i,u)},this.setSize=function(M,y,h=!0){if(T.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}if(i=M,u=y,Q.width=Math.floor(M*r),Q.height=Math.floor(y*r),h===!0)Q.style.width=M+"px",Q.style.height=y+"px";this.setViewport(0,0,M,y)},this.getDrawingBufferSize=function(M){return M.set(i*r,u*r).floor()},this.setDrawingBufferSize=function(M,y,h){i=M,u=y,r=h,Q.width=Math.floor(M*h),Q.height=Math.floor(y*h),this.setViewport(0,0,M,y)},this.getCurrentViewport=function(M){return M.copy(V)},this.getViewport=function(M){return M.copy(g)},this.setViewport=function(M,y,h,x){if(M.isVector4)g.set(M.x,M.y,M.z,M.w);else g.set(M,y,h,x);k0.viewport(V.copy(g).multiplyScalar(r).round())},this.getScissor=function(M){return M.copy($0)},this.setScissor=function(M,y,h,x){if(M.isVector4)$0.set(M.x,M.y,M.z,M.w);else $0.set(M,y,h,x);k0.scissor(A.copy($0).multiplyScalar(r).round())},this.getScissorTest=function(){return w0},this.setScissorTest=function(M){k0.setScissorTest(w0=M)},this.setOpaqueSort=function(M){b=M},this.setTransparentSort=function(M){X0=M},this.getClearColor=function(M){return M.copy(D0.getClearColor())},this.setClearColor=function(){D0.setClearColor(...arguments)},this.getClearAlpha=function(){return D0.getClearAlpha()},this.setClearAlpha=function(){D0.setClearAlpha(...arguments)},this.clear=function(M=!0,y=!0,h=!0){let x=0;if(M){let v=!1;if(S!==null){let e=S.texture.format;v=e===W$||e===Z$||e===$$}if(v){let e=S.texture.type,U0=e===r8||e===e9||e===w6||e===J6||e===J$||e===Q$,O0=D0.getClearColor(),E0=D0.getClearAlpha(),A0=O0.r,v0=O0.g,B0=O0.b;if(U0)O[0]=A0,O[1]=v0,O[2]=B0,O[3]=E0,I.clearBufferuiv(I.COLOR,0,O);else D[0]=A0,D[1]=v0,D[2]=B0,D[3]=E0,I.clearBufferiv(I.COLOR,0,D)}else x|=I.COLOR_BUFFER_BIT}if(y)x|=I.DEPTH_BUFFER_BIT;if(h)x|=I.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295);I.clear(x)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){Q.removeEventListener("webglcontextlost",K0,!1),Q.removeEventListener("webglcontextrestored",H0,!1),Q.removeEventListener("webglcontextcreationerror",F0,!1),D0.dispose(),a.dispose(),d.dispose(),z0.dispose(),PJ.dispose(),CJ.dispose(),R.dispose(),V0.dispose(),q0.dispose(),f.dispose(),T.dispose(),T.removeEventListener("sessionstart",R8),T.removeEventListener("sessionend",k8),K9.stop()};function K0(M){M.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),_=!0}function H0(){console.log("THREE.WebGLRenderer: Context Restored."),_=!1;let M=qJ.autoReset,y=Z0.enabled,h=Z0.autoUpdate,x=Z0.needsUpdate,v=Z0.type;l0(),qJ.autoReset=M,Z0.enabled=y,Z0.autoUpdate=h,Z0.needsUpdate=x,Z0.type=v}function F0(M){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",M.statusMessage)}function t(M){let y=M.target;y.removeEventListener("dispose",t),o(y)}function o(M){R0(M),z0.remove(M)}function R0(M){let y=z0.get(M).programs;if(y!==void 0){if(y.forEach(function(h){f.releaseProgram(h)}),M.isShaderMaterial)f.releaseShaderCache(M)}}this.renderBufferDirect=function(M,y,h,x,v,e){if(y===null)y=S0;let U0=v.isMesh&&v.matrixWorld.determinant()<0,O0=nY(M,y,h,x,v);k0.setMaterial(x,U0);let E0=h.index,A0=1;if(x.wireframe===!0){if(E0=B.getWireframeAttribute(h),E0===void 0)return;A0=2}let v0=h.drawRange,B0=h.attributes.position,c0=v0.start*A0,QJ=(v0.start+v0.count)*A0;if(e!==null)c0=Math.max(c0,e.start*A0),QJ=Math.min(QJ,(e.start+e.count)*A0);if(E0!==null)c0=Math.max(c0,0),QJ=Math.min(QJ,E0.count);else if(B0!==void 0&&B0!==null)c0=Math.max(c0,0),QJ=Math.min(QJ,B0.count);let OJ=QJ-c0;if(OJ<0||OJ===1/0)return;V0.setup(v,x,O0,h,E0);let KJ,HJ=J0;if(E0!==null)KJ=RJ.get(E0),HJ=G0,HJ.setIndex(KJ);if(v.isMesh)if(x.wireframe===!0)k0.setLineWidth(x.wireframeLinewidth*GJ()),HJ.setMode(I.LINES);else HJ.setMode(I.TRIANGLES);else if(v.isLine){let C0=x.linewidth;if(C0===void 0)C0=1;if(k0.setLineWidth(C0*GJ()),v.isLineSegments)HJ.setMode(I.LINES);else if(v.isLineLoop)HJ.setMode(I.LINE_LOOP);else HJ.setMode(I.LINE_STRIP)}else if(v.isPoints)HJ.setMode(I.POINTS);else if(v.isSprite)HJ.setMode(I.TRIANGLES);if(v.isBatchedMesh)if(v._multiDrawInstances!==null)o9("THREE.WebGLRenderer: renderMultiDrawInstances has been deprecated and will be removed in r184. Append to renderMultiDraw arguments and use indirection."),HJ.renderMultiDrawInstances(v._multiDrawStarts,v._multiDrawCounts,v._multiDrawCount,v._multiDrawInstances);else if(!x0.get("WEBGL_multi_draw")){let{_multiDrawStarts:C0,_multiDrawCounts:EJ,_multiDrawCount:i0}=v,pJ=E0?RJ.get(E0).bytesPerElement:1,S9=z0.get(x).currentProgram.getUniforms();for(let lJ=0;lJ<i0;lJ++)S9.setValue(I,"_gl_DrawID",lJ),HJ.render(C0[lJ]/pJ,EJ[lJ])}else HJ.renderMultiDraw(v._multiDrawStarts,v._multiDrawCounts,v._multiDrawCount);else if(v.isInstancedMesh)HJ.renderInstances(c0,OJ,v.count);else if(h.isInstancedBufferGeometry){let C0=h._maxInstanceCount!==void 0?h._maxInstanceCount:1/0,EJ=Math.min(h.instanceCount,C0);HJ.renderInstances(c0,OJ,EJ)}else HJ.render(c0,OJ)};function b0(M,y,h){if(M.transparent===!0&&M.side===$8&&M.forceSinglePass===!1)M.side=uJ,M.needsUpdate=!0,u6(M,y,h),M.side=i8,M.needsUpdate=!0,u6(M,y,h),M.side=$8;else u6(M,y,h)}this.compile=function(M,y,h=null){if(h===null)h=M;if(N=d.get(h),N.init(y),C.push(N),h.traverseVisible(function(v){if(v.isLight&&v.layers.test(y.layers)){if(N.pushLight(v),v.castShadow)N.pushShadow(v)}}),M!==h)M.traverseVisible(function(v){if(v.isLight&&v.layers.test(y.layers)){if(N.pushLight(v),v.castShadow)N.pushShadow(v)}});N.setupLights();let x=new Set;return M.traverse(function(v){if(!(v.isMesh||v.isPoints||v.isLine||v.isSprite))return;let e=v.material;if(e)if(Array.isArray(e))for(let U0=0;U0<e.length;U0++){let O0=e[U0];b0(O0,h,v),x.add(O0)}else b0(e,h,v),x.add(e)}),N=C.pop(),x},this.compileAsync=function(M,y,h=null){let x=this.compile(M,y,h);return new Promise((v)=>{function e(){if(x.forEach(function(U0){if(z0.get(U0).currentProgram.isReady())x.delete(U0)}),x.size===0){v(M);return}setTimeout(e,10)}if(x0.get("KHR_parallel_shader_compile")!==null)e();else setTimeout(e,10)})};let WJ=null;function JJ(M){if(WJ)WJ(M)}function R8(){K9.stop()}function k8(){K9.start()}let K9=new nH;if(K9.setAnimationLoop(JJ),typeof self<"u")K9.setContext(self);this.setAnimationLoop=function(M){WJ=M,T.setAnimationLoop(M),M===null?K9.stop():K9.start()},T.addEventListener("sessionstart",R8),T.addEventListener("sessionend",k8),this.render=function(M,y){if(y!==void 0&&y.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(_===!0)return;if(M.matrixWorldAutoUpdate===!0)M.updateMatrixWorld();if(y.parent===null&&y.matrixWorldAutoUpdate===!0)y.updateMatrixWorld();if(T.enabled===!0&&T.isPresenting===!0){if(T.cameraAutoUpdate===!0)T.updateCamera(y);y=T.getCamera()}if(M.isScene===!0)M.onBeforeRender(L,M,y,S);if(N=d.get(M,C.length),N.init(y),C.push(N),W0.multiplyMatrices(y.projectionMatrix,y.matrixWorldInverse),u0.setFromProjectionMatrix(W0,b$,y.reversedDepth),n=this.localClippingEnabled,s0=N0.init(this.clippingPlanes,n),k=a.get(M,F.length),k.init(),F.push(k),T.enabled===!0&&T.isPresenting===!0){let e=L.xr.getDepthSensingMesh();if(e!==null)kQ(e,y,-1/0,L.sortObjects)}if(kQ(M,y,0,L.sortObjects),k.finish(),L.sortObjects===!0)k.sort(b,X0);if(T0=T.enabled===!1||T.isPresenting===!1||T.hasDepthSensing()===!1,T0)D0.addToRenderList(k,M);if(this.info.render.frame++,s0===!0)N0.beginShadows();let h=N.state.shadowsArray;if(Z0.render(h,M,y),s0===!0)N0.endShadows();if(this.info.autoReset===!0)this.info.reset();let{opaque:x,transmissive:v}=k;if(N.setupLights(),y.isArrayCamera){let e=y.cameras;if(v.length>0)for(let U0=0,O0=e.length;U0<O0;U0++){let E0=e[U0];PZ(x,v,M,E0)}if(T0)D0.render(M);for(let U0=0,O0=e.length;U0<O0;U0++){let E0=e[U0];IZ(k,M,E0,E0.viewport)}}else{if(v.length>0)PZ(x,v,M,y);if(T0)D0.render(M);IZ(k,M,y)}if(S!==null&&w===0)I0.updateMultisampleRenderTarget(S),I0.updateRenderTargetMipmap(S);if(M.isScene===!0)M.onAfterRender(L,M,y);if(V0.resetDefaultState(),p=-1,z=null,C.pop(),C.length>0){if(N=C[C.length-1],s0===!0)N0.setGlobalState(L.clippingPlanes,N.state.camera)}else N=null;if(F.pop(),F.length>0)k=F[F.length-1];else k=null};function kQ(M,y,h,x){if(M.visible===!1)return;if(M.layers.test(y.layers)){if(M.isGroup)h=M.renderOrder;else if(M.isLOD){if(M.autoUpdate===!0)M.update(y)}else if(M.isLight){if(N.pushLight(M),M.castShadow)N.pushShadow(M)}else if(M.isSprite){if(!M.frustumCulled||u0.intersectsSprite(M)){if(x)M0.setFromMatrixPosition(M.matrixWorld).applyMatrix4(W0);let U0=R.update(M),O0=M.material;if(O0.visible)k.push(M,U0,O0,h,M0.z,null)}}else if(M.isMesh||M.isLine||M.isPoints){if(!M.frustumCulled||u0.intersectsObject(M)){let U0=R.update(M),O0=M.material;if(x){if(M.boundingSphere!==void 0){if(M.boundingSphere===null)M.computeBoundingSphere();M0.copy(M.boundingSphere.center)}else{if(U0.boundingSphere===null)U0.computeBoundingSphere();M0.copy(U0.boundingSphere.center)}M0.applyMatrix4(M.matrixWorld).applyMatrix4(W0)}if(Array.isArray(O0)){let E0=U0.groups;for(let A0=0,v0=E0.length;A0<v0;A0++){let B0=E0[A0],c0=O0[B0.materialIndex];if(c0&&c0.visible)k.push(M,U0,c0,h,M0.z,B0)}}else if(O0.visible)k.push(M,U0,O0,h,M0.z,null)}}}let e=M.children;for(let U0=0,O0=e.length;U0<O0;U0++)kQ(e[U0],y,h,x)}function IZ(M,y,h,x){let{opaque:v,transmissive:e,transparent:U0}=M;if(N.setupLightsView(h),s0===!0)N0.setGlobalState(L.clippingPlanes,h);if(x)k0.viewport(V.copy(x));if(v.length>0)m6(v,y,h);if(e.length>0)m6(e,y,h);if(U0.length>0)m6(U0,y,h);k0.buffers.depth.setTest(!0),k0.buffers.depth.setMask(!0),k0.buffers.color.setMask(!0),k0.setPolygonOffset(!1)}function PZ(M,y,h,x){if((h.isScene===!0?h.overrideMaterial:null)!==null)return;if(N.state.transmissionRenderTarget[x.id]===void 0)N.state.transmissionRenderTarget[x.id]=new b8(1,1,{generateMipmaps:!0,type:x0.has("EXT_color_buffer_half_float")||x0.has("EXT_color_buffer_float")?I6:r8,minFilter:h8,samples:4,stencilBuffer:W,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:n0.workingColorSpace});let e=N.state.transmissionRenderTarget[x.id],U0=x.viewport||V;e.setSize(U0.z*L.transmissionResolutionScale,U0.w*L.transmissionResolutionScale);let O0=L.getRenderTarget(),E0=L.getActiveCubeFace(),A0=L.getActiveMipmapLevel();if(L.setRenderTarget(e),L.getClearColor(c),l=L.getClearAlpha(),l<1)L.setClearColor(16777215,0.5);if(L.clear(),T0)D0.render(h);let v0=L.toneMapping;L.toneMapping=v8;let B0=x.viewport;if(x.viewport!==void 0)x.viewport=void 0;if(N.setupLightsView(x),s0===!0)N0.setGlobalState(L.clippingPlanes,x);if(m6(M,h,x),I0.updateMultisampleRenderTarget(e),I0.updateRenderTargetMipmap(e),x0.has("WEBGL_multisampled_render_to_texture")===!1){let c0=!1;for(let QJ=0,OJ=y.length;QJ<OJ;QJ++){let KJ=y[QJ],HJ=KJ.object,C0=KJ.geometry,EJ=KJ.material,i0=KJ.group;if(EJ.side===$8&&HJ.layers.test(x.layers)){let pJ=EJ.side;EJ.side=uJ,EJ.needsUpdate=!0,TZ(HJ,h,x,C0,EJ,i0),EJ.side=pJ,EJ.needsUpdate=!0,c0=!0}}if(c0===!0)I0.updateMultisampleRenderTarget(e),I0.updateRenderTargetMipmap(e)}if(L.setRenderTarget(O0,E0,A0),L.setClearColor(c,l),B0!==void 0)x.viewport=B0;L.toneMapping=v0}function m6(M,y,h){let x=y.isScene===!0?y.overrideMaterial:null;for(let v=0,e=M.length;v<e;v++){let U0=M[v],O0=U0.object,E0=U0.geometry,A0=U0.group,v0=U0.material;if(v0.allowOverride===!0&&x!==null)v0=x;if(O0.layers.test(h.layers))TZ(O0,y,h,E0,v0,A0)}}function TZ(M,y,h,x,v,e){if(M.onBeforeRender(L,y,h,x,v,e),M.modelViewMatrix.multiplyMatrices(h.matrixWorldInverse,M.matrixWorld),M.normalMatrix.getNormalMatrix(M.modelViewMatrix),v.onBeforeRender(L,y,h,x,M,e),v.transparent===!0&&v.side===$8&&v.forceSinglePass===!1)v.side=uJ,v.needsUpdate=!0,L.renderBufferDirect(h,y,x,v,M,e),v.side=i8,v.needsUpdate=!0,L.renderBufferDirect(h,y,x,v,M,e),v.side=$8;else L.renderBufferDirect(h,y,x,v,M,e);M.onAfterRender(L,y,h,x,v,e)}function u6(M,y,h){if(y.isScene!==!0)y=S0;let x=z0.get(M),v=N.state.lights,e=N.state.shadowsArray,U0=v.state.version,O0=f.getParameters(M,v.state,e,y,h),E0=f.getProgramCacheKey(O0),A0=x.programs;if(x.environment=M.isMeshStandardMaterial?y.environment:null,x.fog=y.fog,x.envMap=(M.isMeshStandardMaterial?CJ:PJ).get(M.envMap||x.environment),x.envMapRotation=x.environment!==null&&M.envMap===null?y.environmentRotation:M.envMapRotation,A0===void 0)M.addEventListener("dispose",t),A0=new Map,x.programs=A0;let v0=A0.get(E0);if(v0!==void 0){if(x.currentProgram===v0&&x.lightsStateVersion===U0)return SZ(M,O0),v0}else O0.uniforms=f.getUniforms(M),M.onBeforeCompile(O0,L),v0=f.acquireProgram(O0,E0),A0.set(E0,v0),x.uniforms=O0.uniforms;let B0=x.uniforms;if(!M.isShaderMaterial&&!M.isRawShaderMaterial||M.clipping===!0)B0.clippingPlanes=N0.uniform;if(SZ(M,O0),x.needsLights=oY(M),x.lightsStateVersion=U0,x.needsLights)B0.ambientLightColor.value=v.state.ambient,B0.lightProbe.value=v.state.probe,B0.directionalLights.value=v.state.directional,B0.directionalLightShadows.value=v.state.directionalShadow,B0.spotLights.value=v.state.spot,B0.spotLightShadows.value=v.state.spotShadow,B0.rectAreaLights.value=v.state.rectArea,B0.ltc_1.value=v.state.rectAreaLTC1,B0.ltc_2.value=v.state.rectAreaLTC2,B0.pointLights.value=v.state.point,B0.pointLightShadows.value=v.state.pointShadow,B0.hemisphereLights.value=v.state.hemi,B0.directionalShadowMap.value=v.state.directionalShadowMap,B0.directionalShadowMatrix.value=v.state.directionalShadowMatrix,B0.spotShadowMap.value=v.state.spotShadowMap,B0.spotLightMatrix.value=v.state.spotLightMatrix,B0.spotLightMap.value=v.state.spotLightMap,B0.pointShadowMap.value=v.state.pointShadowMap,B0.pointShadowMatrix.value=v.state.pointShadowMatrix;return x.currentProgram=v0,x.uniformsList=null,v0}function AZ(M){if(M.uniformsList===null){let y=M.currentProgram.getUniforms();M.uniformsList=l6.seqWithValue(y.seq,M.uniforms)}return M.uniformsList}function SZ(M,y){let h=z0.get(M);h.outputColorSpace=y.outputColorSpace,h.batching=y.batching,h.batchingColor=y.batchingColor,h.instancing=y.instancing,h.instancingColor=y.instancingColor,h.instancingMorph=y.instancingMorph,h.skinning=y.skinning,h.morphTargets=y.morphTargets,h.morphNormals=y.morphNormals,h.morphColors=y.morphColors,h.morphTargetsCount=y.morphTargetsCount,h.numClippingPlanes=y.numClippingPlanes,h.numIntersection=y.numClipIntersection,h.vertexAlphas=y.vertexAlphas,h.vertexTangents=y.vertexTangents,h.toneMapping=y.toneMapping}function nY(M,y,h,x,v){if(y.isScene!==!0)y=S0;I0.resetTextureUnits();let e=y.fog,U0=x.isMeshStandardMaterial?y.environment:null,O0=S===null?L.outputColorSpace:S.isXRRenderTarget===!0?S.texture.colorSpace:hJ,E0=(x.isMeshStandardMaterial?CJ:PJ).get(x.envMap||U0),A0=x.vertexColors===!0&&!!h.attributes.color&&h.attributes.color.itemSize===4,v0=!!h.attributes.tangent&&(!!x.normalMap||x.anisotropy>0),B0=!!h.morphAttributes.position,c0=!!h.morphAttributes.normal,QJ=!!h.morphAttributes.color,OJ=v8;if(x.toneMapped){if(S===null||S.isXRRenderTarget===!0)OJ=L.toneMapping}let KJ=h.morphAttributes.position||h.morphAttributes.normal||h.morphAttributes.color,HJ=KJ!==void 0?KJ.length:0,C0=z0.get(x),EJ=N.state.lights;if(s0===!0){if(n===!0||M!==z){let vJ=M===z&&x.id===p;N0.setState(x,M,vJ)}}let i0=!1;if(x.version===C0.__version){if(C0.needsLights&&C0.lightsStateVersion!==EJ.state.version)i0=!0;else if(C0.outputColorSpace!==O0)i0=!0;else if(v.isBatchedMesh&&C0.batching===!1)i0=!0;else if(!v.isBatchedMesh&&C0.batching===!0)i0=!0;else if(v.isBatchedMesh&&C0.batchingColor===!0&&v.colorTexture===null)i0=!0;else if(v.isBatchedMesh&&C0.batchingColor===!1&&v.colorTexture!==null)i0=!0;else if(v.isInstancedMesh&&C0.instancing===!1)i0=!0;else if(!v.isInstancedMesh&&C0.instancing===!0)i0=!0;else if(v.isSkinnedMesh&&C0.skinning===!1)i0=!0;else if(!v.isSkinnedMesh&&C0.skinning===!0)i0=!0;else if(v.isInstancedMesh&&C0.instancingColor===!0&&v.instanceColor===null)i0=!0;else if(v.isInstancedMesh&&C0.instancingColor===!1&&v.instanceColor!==null)i0=!0;else if(v.isInstancedMesh&&C0.instancingMorph===!0&&v.morphTexture===null)i0=!0;else if(v.isInstancedMesh&&C0.instancingMorph===!1&&v.morphTexture!==null)i0=!0;else if(C0.envMap!==E0)i0=!0;else if(x.fog===!0&&C0.fog!==e)i0=!0;else if(C0.numClippingPlanes!==void 0&&(C0.numClippingPlanes!==N0.numPlanes||C0.numIntersection!==N0.numIntersection))i0=!0;else if(C0.vertexAlphas!==A0)i0=!0;else if(C0.vertexTangents!==v0)i0=!0;else if(C0.morphTargets!==B0)i0=!0;else if(C0.morphNormals!==c0)i0=!0;else if(C0.morphColors!==QJ)i0=!0;else if(C0.toneMapping!==OJ)i0=!0;else if(C0.morphTargetsCount!==HJ)i0=!0}else i0=!0,C0.__version=x.version;let pJ=C0.currentProgram;if(i0===!0)pJ=u6(x,y,v);let S9=!1,lJ=!1,E6=!1,NJ=pJ.getUniforms(),rJ=C0.uniforms;if(k0.useProgram(pJ.program))S9=!0,lJ=!0,E6=!0;if(x.id!==p)p=x.id,lJ=!0;if(S9||z!==M){if(k0.buffers.depth.getReversed()&&M.reversedDepth!==!0)M._reversedDepth=!0,M.updateProjectionMatrix();NJ.setValue(I,"projectionMatrix",M.projectionMatrix),NJ.setValue(I,"viewMatrix",M.matrixWorldInverse);let xJ=NJ.map.cameraPosition;if(xJ!==void 0)xJ.setValue(I,Q0.setFromMatrixPosition(M.matrixWorld));if(h0.logarithmicDepthBuffer)NJ.setValue(I,"logDepthBufFC",2/(Math.log(M.far+1)/Math.LN2));if(x.isMeshPhongMaterial||x.isMeshToonMaterial||x.isMeshLambertMaterial||x.isMeshBasicMaterial||x.isMeshStandardMaterial||x.isShaderMaterial)NJ.setValue(I,"isOrthographic",M.isOrthographicCamera===!0);if(z!==M)z=M,lJ=!0,E6=!0}if(v.isSkinnedMesh){NJ.setOptional(I,v,"bindMatrix"),NJ.setOptional(I,v,"bindMatrixInverse");let vJ=v.skeleton;if(vJ){if(vJ.boneTexture===null)vJ.computeBoneTexture();NJ.setValue(I,"boneTexture",vJ.boneTexture,I0)}}if(v.isBatchedMesh){if(NJ.setOptional(I,v,"batchingTexture"),NJ.setValue(I,"batchingTexture",v._matricesTexture,I0),NJ.setOptional(I,v,"batchingIdTexture"),NJ.setValue(I,"batchingIdTexture",v._indirectTexture,I0),NJ.setOptional(I,v,"batchingColorTexture"),v._colorsTexture!==null)NJ.setValue(I,"batchingColorTexture",v._colorsTexture,I0)}let tJ=h.morphAttributes;if(tJ.position!==void 0||tJ.normal!==void 0||tJ.color!==void 0)y0.update(v,h,pJ);if(lJ||C0.receiveShadow!==v.receiveShadow)C0.receiveShadow=v.receiveShadow,NJ.setValue(I,"receiveShadow",v.receiveShadow);if(x.isMeshGouraudMaterial&&x.envMap!==null)rJ.envMap.value=E0,rJ.flipEnvMap.value=E0.isCubeTexture&&E0.isRenderTargetTexture===!1?-1:1;if(x.isMeshStandardMaterial&&x.envMap===null&&y.environment!==null)rJ.envMapIntensity.value=y.environmentIntensity;if(lJ){if(NJ.setValue(I,"toneMappingExposure",L.toneMappingExposure),C0.needsLights)sY(rJ,E6);if(e&&x.fog===!0)s.refreshFogUniforms(rJ,e);s.refreshMaterialUniforms(rJ,x,r,u,N.state.transmissionRenderTarget[M.id]),l6.upload(I,AZ(C0),rJ,I0)}if(x.isShaderMaterial&&x.uniformsNeedUpdate===!0)l6.upload(I,AZ(C0),rJ,I0),x.uniformsNeedUpdate=!1;if(x.isSpriteMaterial)NJ.setValue(I,"center",v.center);if(NJ.setValue(I,"modelViewMatrix",v.modelViewMatrix),NJ.setValue(I,"normalMatrix",v.normalMatrix),NJ.setValue(I,"modelMatrix",v.matrixWorld),x.isShaderMaterial||x.isRawShaderMaterial){let vJ=x.uniformsGroups;for(let xJ=0,DQ=vJ.length;xJ<DQ;xJ++){let U9=vJ[xJ];q0.update(U9,pJ),q0.bind(U9,pJ)}}return pJ}function sY(M,y){M.ambientLightColor.needsUpdate=y,M.lightProbe.needsUpdate=y,M.directionalLights.needsUpdate=y,M.directionalLightShadows.needsUpdate=y,M.pointLights.needsUpdate=y,M.pointLightShadows.needsUpdate=y,M.spotLights.needsUpdate=y,M.spotLightShadows.needsUpdate=y,M.rectAreaLights.needsUpdate=y,M.hemisphereLights.needsUpdate=y}function oY(M){return M.isMeshLambertMaterial||M.isMeshToonMaterial||M.isMeshPhongMaterial||M.isMeshStandardMaterial||M.isShadowMaterial||M.isShaderMaterial&&M.lights===!0}this.getActiveCubeFace=function(){return j},this.getActiveMipmapLevel=function(){return w},this.getRenderTarget=function(){return S},this.setRenderTargetTextures=function(M,y,h){let x=z0.get(M);if(x.__autoAllocateDepthBuffer=M.resolveDepthBuffer===!1,x.__autoAllocateDepthBuffer===!1)x.__useRenderToTexture=!1;z0.get(M.texture).__webglTexture=y,z0.get(M.depthTexture).__webglTexture=x.__autoAllocateDepthBuffer?void 0:h,x.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(M,y){let h=z0.get(M);h.__webglFramebuffer=y,h.__useDefaultFramebuffer=y===void 0};let iY=I.createFramebuffer();this.setRenderTarget=function(M,y=0,h=0){S=M,j=y,w=h;let x=!0,v=null,e=!1,U0=!1;if(M){let E0=z0.get(M);if(E0.__useDefaultFramebuffer!==void 0)k0.bindFramebuffer(I.FRAMEBUFFER,null),x=!1;else if(E0.__webglFramebuffer===void 0)I0.setupRenderTarget(M);else if(E0.__hasExternalTextures)I0.rebindTextures(M,z0.get(M.texture).__webglTexture,z0.get(M.depthTexture).__webglTexture);else if(M.depthBuffer){let B0=M.depthTexture;if(E0.__boundDepthTexture!==B0){if(B0!==null&&z0.has(B0)&&(M.width!==B0.image.width||M.height!==B0.image.height))throw Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");I0.setupDepthRenderbuffer(M)}}let A0=M.texture;if(A0.isData3DTexture||A0.isDataArrayTexture||A0.isCompressedArrayTexture)U0=!0;let v0=z0.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget){if(Array.isArray(v0[y]))v=v0[y][h];else v=v0[y];e=!0}else if(M.samples>0&&I0.useMultisampledRTT(M)===!1)v=z0.get(M).__webglMultisampledFramebuffer;else if(Array.isArray(v0))v=v0[h];else v=v0;V.copy(M.viewport),A.copy(M.scissor),m=M.scissorTest}else V.copy(g).multiplyScalar(r).floor(),A.copy($0).multiplyScalar(r).floor(),m=w0;if(h!==0)v=iY;if(k0.bindFramebuffer(I.FRAMEBUFFER,v)&&x)k0.drawBuffers(M,v);if(k0.viewport(V),k0.scissor(A),k0.setScissorTest(m),e){let E0=z0.get(M.texture);I.framebufferTexture2D(I.FRAMEBUFFER,I.COLOR_ATTACHMENT0,I.TEXTURE_CUBE_MAP_POSITIVE_X+y,E0.__webglTexture,h)}else if(U0){let E0=y;for(let A0=0;A0<M.textures.length;A0++){let v0=z0.get(M.textures[A0]);I.framebufferTextureLayer(I.FRAMEBUFFER,I.COLOR_ATTACHMENT0+A0,v0.__webglTexture,h,E0)}}else if(M!==null&&h!==0){let E0=z0.get(M.texture);I.framebufferTexture2D(I.FRAMEBUFFER,I.COLOR_ATTACHMENT0,I.TEXTURE_2D,E0.__webglTexture,h)}p=-1},this.readRenderTargetPixels=function(M,y,h,x,v,e,U0,O0=0){if(!(M&&M.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let E0=z0.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&U0!==void 0)E0=E0[U0];if(E0){k0.bindFramebuffer(I.FRAMEBUFFER,E0);try{let A0=M.textures[O0],v0=A0.format,B0=A0.type;if(!h0.textureFormatReadable(v0)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!h0.textureTypeReadable(B0)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}if(y>=0&&y<=M.width-x&&(h>=0&&h<=M.height-v)){if(M.textures.length>1)I.readBuffer(I.COLOR_ATTACHMENT0+O0);I.readPixels(y,h,x,v,L0.convert(v0),L0.convert(B0),e)}}finally{let A0=S!==null?z0.get(S).__webglFramebuffer:null;k0.bindFramebuffer(I.FRAMEBUFFER,A0)}}},this.readRenderTargetPixelsAsync=async function(M,y,h,x,v,e,U0,O0=0){if(!(M&&M.isWebGLRenderTarget))throw Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let E0=z0.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&U0!==void 0)E0=E0[U0];if(E0)if(y>=0&&y<=M.width-x&&(h>=0&&h<=M.height-v)){k0.bindFramebuffer(I.FRAMEBUFFER,E0);let A0=M.textures[O0],v0=A0.format,B0=A0.type;if(!h0.textureFormatReadable(v0))throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!h0.textureTypeReadable(B0))throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let c0=I.createBuffer();if(I.bindBuffer(I.PIXEL_PACK_BUFFER,c0),I.bufferData(I.PIXEL_PACK_BUFFER,e.byteLength,I.STREAM_READ),M.textures.length>1)I.readBuffer(I.COLOR_ATTACHMENT0+O0);I.readPixels(y,h,x,v,L0.convert(v0),L0.convert(B0),0);let QJ=S!==null?z0.get(S).__webglFramebuffer:null;k0.bindFramebuffer(I.FRAMEBUFFER,QJ);let OJ=I.fenceSync(I.SYNC_GPU_COMMANDS_COMPLETE,0);return I.flush(),await NH(I,OJ,4),I.bindBuffer(I.PIXEL_PACK_BUFFER,c0),I.getBufferSubData(I.PIXEL_PACK_BUFFER,0,e),I.deleteBuffer(c0),I.deleteSync(OJ),e}else throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(M,y=null,h=0){let x=Math.pow(2,-h),v=Math.floor(M.image.width*x),e=Math.floor(M.image.height*x),U0=y!==null?y.x:0,O0=y!==null?y.y:0;I0.setTexture2D(M,0),I.copyTexSubImage2D(I.TEXTURE_2D,h,0,0,U0,O0,v,e),k0.unbindTexture()};let aY=I.createFramebuffer(),rY=I.createFramebuffer();if(this.copyTextureToTexture=function(M,y,h=null,x=null,v=0,e=null){if(e===null)if(v!==0)o9("WebGLRenderer: copyTextureToTexture function signature has changed to support src and dst mipmap levels."),e=v,v=0;else e=0;let U0,O0,E0,A0,v0,B0,c0,QJ,OJ,KJ=M.isCompressedTexture?M.mipmaps[e]:M.image;if(h!==null)U0=h.max.x-h.min.x,O0=h.max.y-h.min.y,E0=h.isBox3?h.max.z-h.min.z:1,A0=h.min.x,v0=h.min.y,B0=h.isBox3?h.min.z:0;else{let tJ=Math.pow(2,-v);if(U0=Math.floor(KJ.width*tJ),O0=Math.floor(KJ.height*tJ),M.isDataArrayTexture)E0=KJ.depth;else if(M.isData3DTexture)E0=Math.floor(KJ.depth*tJ);else E0=1;A0=0,v0=0,B0=0}if(x!==null)c0=x.x,QJ=x.y,OJ=x.z;else c0=0,QJ=0,OJ=0;let HJ=L0.convert(y.format),C0=L0.convert(y.type),EJ;if(y.isData3DTexture)I0.setTexture3D(y,0),EJ=I.TEXTURE_3D;else if(y.isDataArrayTexture||y.isCompressedArrayTexture)I0.setTexture2DArray(y,0),EJ=I.TEXTURE_2D_ARRAY;else I0.setTexture2D(y,0),EJ=I.TEXTURE_2D;I.pixelStorei(I.UNPACK_FLIP_Y_WEBGL,y.flipY),I.pixelStorei(I.UNPACK_PREMULTIPLY_ALPHA_WEBGL,y.premultiplyAlpha),I.pixelStorei(I.UNPACK_ALIGNMENT,y.unpackAlignment);let i0=I.getParameter(I.UNPACK_ROW_LENGTH),pJ=I.getParameter(I.UNPACK_IMAGE_HEIGHT),S9=I.getParameter(I.UNPACK_SKIP_PIXELS),lJ=I.getParameter(I.UNPACK_SKIP_ROWS),E6=I.getParameter(I.UNPACK_SKIP_IMAGES);I.pixelStorei(I.UNPACK_ROW_LENGTH,KJ.width),I.pixelStorei(I.UNPACK_IMAGE_HEIGHT,KJ.height),I.pixelStorei(I.UNPACK_SKIP_PIXELS,A0),I.pixelStorei(I.UNPACK_SKIP_ROWS,v0),I.pixelStorei(I.UNPACK_SKIP_IMAGES,B0);let NJ=M.isDataArrayTexture||M.isData3DTexture,rJ=y.isDataArrayTexture||y.isData3DTexture;if(M.isDepthTexture){let tJ=z0.get(M),vJ=z0.get(y),xJ=z0.get(tJ.__renderTarget),DQ=z0.get(vJ.__renderTarget);k0.bindFramebuffer(I.READ_FRAMEBUFFER,xJ.__webglFramebuffer),k0.bindFramebuffer(I.DRAW_FRAMEBUFFER,DQ.__webglFramebuffer);for(let U9=0;U9<E0;U9++){if(NJ)I.framebufferTextureLayer(I.READ_FRAMEBUFFER,I.COLOR_ATTACHMENT0,z0.get(M).__webglTexture,v,B0+U9),I.framebufferTextureLayer(I.DRAW_FRAMEBUFFER,I.COLOR_ATTACHMENT0,z0.get(y).__webglTexture,e,OJ+U9);I.blitFramebuffer(A0,v0,U0,O0,c0,QJ,U0,O0,I.DEPTH_BUFFER_BIT,I.NEAREST)}k0.bindFramebuffer(I.READ_FRAMEBUFFER,null),k0.bindFramebuffer(I.DRAW_FRAMEBUFFER,null)}else if(v!==0||M.isRenderTargetTexture||z0.has(M)){let tJ=z0.get(M),vJ=z0.get(y);k0.bindFramebuffer(I.READ_FRAMEBUFFER,aY),k0.bindFramebuffer(I.DRAW_FRAMEBUFFER,rY);for(let xJ=0;xJ<E0;xJ++){if(NJ)I.framebufferTextureLayer(I.READ_FRAMEBUFFER,I.COLOR_ATTACHMENT0,tJ.__webglTexture,v,B0+xJ);else I.framebufferTexture2D(I.READ_FRAMEBUFFER,I.COLOR_ATTACHMENT0,I.TEXTURE_2D,tJ.__webglTexture,v);if(rJ)I.framebufferTextureLayer(I.DRAW_FRAMEBUFFER,I.COLOR_ATTACHMENT0,vJ.__webglTexture,e,OJ+xJ);else I.framebufferTexture2D(I.DRAW_FRAMEBUFFER,I.COLOR_ATTACHMENT0,I.TEXTURE_2D,vJ.__webglTexture,e);if(v!==0)I.blitFramebuffer(A0,v0,U0,O0,c0,QJ,U0,O0,I.COLOR_BUFFER_BIT,I.NEAREST);else if(rJ)I.copyTexSubImage3D(EJ,e,c0,QJ,OJ+xJ,A0,v0,U0,O0);else I.copyTexSubImage2D(EJ,e,c0,QJ,A0,v0,U0,O0)}k0.bindFramebuffer(I.READ_FRAMEBUFFER,null),k0.bindFramebuffer(I.DRAW_FRAMEBUFFER,null)}else if(rJ)if(M.isDataTexture||M.isData3DTexture)I.texSubImage3D(EJ,e,c0,QJ,OJ,U0,O0,E0,HJ,C0,KJ.data);else if(y.isCompressedArrayTexture)I.compressedTexSubImage3D(EJ,e,c0,QJ,OJ,U0,O0,E0,HJ,KJ.data);else I.texSubImage3D(EJ,e,c0,QJ,OJ,U0,O0,E0,HJ,C0,KJ);else if(M.isDataTexture)I.texSubImage2D(I.TEXTURE_2D,e,c0,QJ,U0,O0,HJ,C0,KJ.data);else if(M.isCompressedTexture)I.compressedTexSubImage2D(I.TEXTURE_2D,e,c0,QJ,KJ.width,KJ.height,HJ,KJ.data);else I.texSubImage2D(I.TEXTURE_2D,e,c0,QJ,U0,O0,HJ,C0,KJ);if(I.pixelStorei(I.UNPACK_ROW_LENGTH,i0),I.pixelStorei(I.UNPACK_IMAGE_HEIGHT,pJ),I.pixelStorei(I.UNPACK_SKIP_PIXELS,S9),I.pixelStorei(I.UNPACK_SKIP_ROWS,lJ),I.pixelStorei(I.UNPACK_SKIP_IMAGES,E6),e===0&&y.generateMipmaps)I.generateMipmap(EJ);k0.unbindTexture()},this.initRenderTarget=function(M){if(z0.get(M).__webglFramebuffer===void 0)I0.setupRenderTarget(M)},this.initTexture=function(M){if(M.isCubeTexture)I0.setTextureCube(M,0);else if(M.isData3DTexture)I0.setTexture3D(M,0);else if(M.isDataArrayTexture||M.isCompressedArrayTexture)I0.setTexture2DArray(M,0);else I0.setTexture2D(M,0);k0.unbindTexture()},this.resetState=function(){j=0,w=0,S=null,k0.reset(),V0.reset()},typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return b$}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(J){this._outputColorSpace=J;let Q=this.getContext();Q.drawingBufferColorSpace=n0._getDrawingBufferColorSpace(J),Q.unpackColorSpace=n0._getUnpackColorSpace()}}var WY={type:"change"},RZ={type:"start"},YY={type:"end"},EQ=new F8,HY=new K8,wq=Math.cos(70*cJ.DEG2RAD),zJ=new P,bJ=2*Math.PI,$J={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},OZ=0.000001;class kZ extends XQ{constructor(J,Q=null){super(J,Q);if(this.state=$J.NONE,this.target=new P,this.cursor=new P,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=0.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:s8.ROTATE,MIDDLE:s8.DOLLY,RIGHT:s8.PAN},this.touches={ONE:o8.ROTATE,TWO:o8.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._domElementKeyEvents=null,this._lastPosition=new P,this._lastQuaternion=new jJ,this._lastTargetPosition=new P,this._quat=new jJ().setFromUnitVectors(J.up,new P(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new z9,this._sphericalDelta=new z9,this._scale=1,this._panOffset=new P,this._rotateStart=new _0,this._rotateEnd=new _0,this._rotateDelta=new _0,this._panStart=new _0,this._panEnd=new _0,this._panDelta=new _0,this._dollyStart=new _0,this._dollyEnd=new _0,this._dollyDelta=new _0,this._dollyDirection=new P,this._mouse=new _0,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=Pq.bind(this),this._onPointerDown=Iq.bind(this),this._onPointerUp=Tq.bind(this),this._onContextMenu=hq.bind(this),this._onMouseWheel=jq.bind(this),this._onKeyDown=yq.bind(this),this._onTouchStart=vq.bind(this),this._onTouchMove=fq.bind(this),this._onMouseDown=Aq.bind(this),this._onMouseMove=Sq.bind(this),this._interceptControlDown=xq.bind(this),this._interceptControlUp=bq.bind(this),this.domElement!==null)this.connect(this.domElement);this.update()}connect(J){super.connect(J),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(J){J.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=J}stopListenToKeyEvents(){if(this._domElementKeyEvents!==null)this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(WY),this.update(),this.state=$J.NONE}update(J=null){let Q=this.object.position;if(zJ.copy(Q).sub(this.target),zJ.applyQuaternion(this._quat),this._spherical.setFromVector3(zJ),this.autoRotate&&this.state===$J.NONE)this._rotateLeft(this._getAutoRotationAngle(J));if(this.enableDamping)this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor;else this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi;let $=this.minAzimuthAngle,Z=this.maxAzimuthAngle;if(isFinite($)&&isFinite(Z)){if($<-Math.PI)$+=bJ;else if($>Math.PI)$-=bJ;if(Z<-Math.PI)Z+=bJ;else if(Z>Math.PI)Z-=bJ;if($<=Z)this._spherical.theta=Math.max($,Math.min(Z,this._spherical.theta));else this._spherical.theta=this._spherical.theta>($+Z)/2?Math.max($,this._spherical.theta):Math.min(Z,this._spherical.theta)}if(this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0)this.target.addScaledVector(this._panOffset,this.dampingFactor);else this.target.add(this._panOffset);this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let W=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let H=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),W=H!=this._spherical.radius}if(zJ.setFromSpherical(this._spherical),zJ.applyQuaternion(this._quatInverse),Q.copy(this.target).add(zJ),this.object.lookAt(this.target),this.enableDamping===!0)this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor);else this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0);if(this.zoomToCursor&&this._performCursorZoom){let H=null;if(this.object.isPerspectiveCamera){let Y=zJ.length();H=this._clampDistance(Y*this._scale);let X=Y-H;this.object.position.addScaledVector(this._dollyDirection,X),this.object.updateMatrixWorld(),W=!!X}else if(this.object.isOrthographicCamera){let Y=new P(this._mouse.x,this._mouse.y,0);Y.unproject(this.object);let X=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),W=X!==this.object.zoom;let K=new P(this._mouse.x,this._mouse.y,0);K.unproject(this.object),this.object.position.sub(K).add(Y),this.object.updateMatrixWorld(),H=zJ.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;if(H!==null)if(this.screenSpacePanning)this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(H).add(this.object.position);else if(EQ.origin.copy(this.object.position),EQ.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(EQ.direction))<wq)this.object.lookAt(this.target);else HY.setFromNormalAndCoplanarPoint(this.object.up,this.target),EQ.intersectPlane(HY,this.target)}else if(this.object.isOrthographicCamera){let H=this.object.zoom;if(this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),H!==this.object.zoom)this.object.updateProjectionMatrix(),W=!0}if(this._scale=1,this._performCursorZoom=!1,W||this._lastPosition.distanceToSquared(this.object.position)>OZ||8*(1-this._lastQuaternion.dot(this.object.quaternion))>OZ||this._lastTargetPosition.distanceToSquared(this.target)>OZ)return this.dispatchEvent(WY),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0;return!1}_getAutoRotationAngle(J){if(J!==null)return bJ/60*this.autoRotateSpeed*J;else return bJ/60/60*this.autoRotateSpeed}_getZoomScale(J){let Q=Math.abs(J*0.01);return Math.pow(0.95,this.zoomSpeed*Q)}_rotateLeft(J){this._sphericalDelta.theta-=J}_rotateUp(J){this._sphericalDelta.phi-=J}_panLeft(J,Q){zJ.setFromMatrixColumn(Q,0),zJ.multiplyScalar(-J),this._panOffset.add(zJ)}_panUp(J,Q){if(this.screenSpacePanning===!0)zJ.setFromMatrixColumn(Q,1);else zJ.setFromMatrixColumn(Q,0),zJ.crossVectors(this.object.up,zJ);zJ.multiplyScalar(J),this._panOffset.add(zJ)}_pan(J,Q){let $=this.domElement;if(this.object.isPerspectiveCamera){let Z=this.object.position;zJ.copy(Z).sub(this.target);let W=zJ.length();W*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*J*W/$.clientHeight,this.object.matrix),this._panUp(2*Q*W/$.clientHeight,this.object.matrix)}else if(this.object.isOrthographicCamera)this._panLeft(J*(this.object.right-this.object.left)/this.object.zoom/$.clientWidth,this.object.matrix),this._panUp(Q*(this.object.top-this.object.bottom)/this.object.zoom/$.clientHeight,this.object.matrix);else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1}_dollyOut(J){if(this.object.isPerspectiveCamera||this.object.isOrthographicCamera)this._scale/=J;else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1}_dollyIn(J){if(this.object.isPerspectiveCamera||this.object.isOrthographicCamera)this._scale*=J;else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1}_updateZoomParameters(J,Q){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let $=this.domElement.getBoundingClientRect(),Z=J-$.left,W=Q-$.top,H=$.width,Y=$.height;this._mouse.x=Z/H*2-1,this._mouse.y=-(W/Y)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(J){return Math.max(this.minDistance,Math.min(this.maxDistance,J))}_handleMouseDownRotate(J){this._rotateStart.set(J.clientX,J.clientY)}_handleMouseDownDolly(J){this._updateZoomParameters(J.clientX,J.clientX),this._dollyStart.set(J.clientX,J.clientY)}_handleMouseDownPan(J){this._panStart.set(J.clientX,J.clientY)}_handleMouseMoveRotate(J){this._rotateEnd.set(J.clientX,J.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let Q=this.domElement;this._rotateLeft(bJ*this._rotateDelta.x/Q.clientHeight),this._rotateUp(bJ*this._rotateDelta.y/Q.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(J){if(this._dollyEnd.set(J.clientX,J.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0)this._dollyOut(this._getZoomScale(this._dollyDelta.y));else if(this._dollyDelta.y<0)this._dollyIn(this._getZoomScale(this._dollyDelta.y));this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(J){this._panEnd.set(J.clientX,J.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(J){if(this._updateZoomParameters(J.clientX,J.clientY),J.deltaY<0)this._dollyIn(this._getZoomScale(J.deltaY));else if(J.deltaY>0)this._dollyOut(this._getZoomScale(J.deltaY));this.update()}_handleKeyDown(J){let Q=!1;switch(J.code){case this.keys.UP:if(J.ctrlKey||J.metaKey||J.shiftKey){if(this.enableRotate)this._rotateUp(bJ*this.keyRotateSpeed/this.domElement.clientHeight)}else if(this.enablePan)this._pan(0,this.keyPanSpeed);Q=!0;break;case this.keys.BOTTOM:if(J.ctrlKey||J.metaKey||J.shiftKey){if(this.enableRotate)this._rotateUp(-bJ*this.keyRotateSpeed/this.domElement.clientHeight)}else if(this.enablePan)this._pan(0,-this.keyPanSpeed);Q=!0;break;case this.keys.LEFT:if(J.ctrlKey||J.metaKey||J.shiftKey){if(this.enableRotate)this._rotateLeft(bJ*this.keyRotateSpeed/this.domElement.clientHeight)}else if(this.enablePan)this._pan(this.keyPanSpeed,0);Q=!0;break;case this.keys.RIGHT:if(J.ctrlKey||J.metaKey||J.shiftKey){if(this.enableRotate)this._rotateLeft(-bJ*this.keyRotateSpeed/this.domElement.clientHeight)}else if(this.enablePan)this._pan(-this.keyPanSpeed,0);Q=!0;break}if(Q)J.preventDefault(),this.update()}_handleTouchStartRotate(J){if(this._pointers.length===1)this._rotateStart.set(J.pageX,J.pageY);else{let Q=this._getSecondPointerPosition(J),$=0.5*(J.pageX+Q.x),Z=0.5*(J.pageY+Q.y);this._rotateStart.set($,Z)}}_handleTouchStartPan(J){if(this._pointers.length===1)this._panStart.set(J.pageX,J.pageY);else{let Q=this._getSecondPointerPosition(J),$=0.5*(J.pageX+Q.x),Z=0.5*(J.pageY+Q.y);this._panStart.set($,Z)}}_handleTouchStartDolly(J){let Q=this._getSecondPointerPosition(J),$=J.pageX-Q.x,Z=J.pageY-Q.y,W=Math.sqrt($*$+Z*Z);this._dollyStart.set(0,W)}_handleTouchStartDollyPan(J){if(this.enableZoom)this._handleTouchStartDolly(J);if(this.enablePan)this._handleTouchStartPan(J)}_handleTouchStartDollyRotate(J){if(this.enableZoom)this._handleTouchStartDolly(J);if(this.enableRotate)this._handleTouchStartRotate(J)}_handleTouchMoveRotate(J){if(this._pointers.length==1)this._rotateEnd.set(J.pageX,J.pageY);else{let $=this._getSecondPointerPosition(J),Z=0.5*(J.pageX+$.x),W=0.5*(J.pageY+$.y);this._rotateEnd.set(Z,W)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let Q=this.domElement;this._rotateLeft(bJ*this._rotateDelta.x/Q.clientHeight),this._rotateUp(bJ*this._rotateDelta.y/Q.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(J){if(this._pointers.length===1)this._panEnd.set(J.pageX,J.pageY);else{let Q=this._getSecondPointerPosition(J),$=0.5*(J.pageX+Q.x),Z=0.5*(J.pageY+Q.y);this._panEnd.set($,Z)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(J){let Q=this._getSecondPointerPosition(J),$=J.pageX-Q.x,Z=J.pageY-Q.y,W=Math.sqrt($*$+Z*Z);this._dollyEnd.set(0,W),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let H=(J.pageX+Q.x)*0.5,Y=(J.pageY+Q.y)*0.5;this._updateZoomParameters(H,Y)}_handleTouchMoveDollyPan(J){if(this.enableZoom)this._handleTouchMoveDolly(J);if(this.enablePan)this._handleTouchMovePan(J)}_handleTouchMoveDollyRotate(J){if(this.enableZoom)this._handleTouchMoveDolly(J);if(this.enableRotate)this._handleTouchMoveRotate(J)}_addPointer(J){this._pointers.push(J.pointerId)}_removePointer(J){delete this._pointerPositions[J.pointerId];for(let Q=0;Q<this._pointers.length;Q++)if(this._pointers[Q]==J.pointerId){this._pointers.splice(Q,1);return}}_isTrackingPointer(J){for(let Q=0;Q<this._pointers.length;Q++)if(this._pointers[Q]==J.pointerId)return!0;return!1}_trackPointer(J){let Q=this._pointerPositions[J.pointerId];if(Q===void 0)Q=new _0,this._pointerPositions[J.pointerId]=Q;Q.set(J.pageX,J.pageY)}_getSecondPointerPosition(J){let Q=J.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[Q]}_customWheelEvent(J){let Q=J.deltaMode,$={clientX:J.clientX,clientY:J.clientY,deltaY:J.deltaY};switch(Q){case 1:$.deltaY*=16;break;case 2:$.deltaY*=100;break}if(J.ctrlKey&&!this._controlActive)$.deltaY*=10;return $}}function Iq(J){if(this.enabled===!1)return;if(this._pointers.length===0)this.domElement.setPointerCapture(J.pointerId),this.domElement.addEventListener("pointermove",this._onPointerMove),this.domElement.addEventListener("pointerup",this._onPointerUp);if(this._isTrackingPointer(J))return;if(this._addPointer(J),J.pointerType==="touch")this._onTouchStart(J);else this._onMouseDown(J)}function Pq(J){if(this.enabled===!1)return;if(J.pointerType==="touch")this._onTouchMove(J);else this._onMouseMove(J)}function Tq(J){switch(this._removePointer(J),this._pointers.length){case 0:this.domElement.releasePointerCapture(J.pointerId),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(YY),this.state=$J.NONE;break;case 1:let Q=this._pointers[0],$=this._pointerPositions[Q];this._onTouchStart({pointerId:Q,pageX:$.x,pageY:$.y});break}}function Aq(J){let Q;switch(J.button){case 0:Q=this.mouseButtons.LEFT;break;case 1:Q=this.mouseButtons.MIDDLE;break;case 2:Q=this.mouseButtons.RIGHT;break;default:Q=-1}switch(Q){case s8.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(J),this.state=$J.DOLLY;break;case s8.ROTATE:if(J.ctrlKey||J.metaKey||J.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(J),this.state=$J.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(J),this.state=$J.ROTATE}break;case s8.PAN:if(J.ctrlKey||J.metaKey||J.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(J),this.state=$J.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(J),this.state=$J.PAN}break;default:this.state=$J.NONE}if(this.state!==$J.NONE)this.dispatchEvent(RZ)}function Sq(J){switch(this.state){case $J.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(J);break;case $J.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(J);break;case $J.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(J);break}}function jq(J){if(this.enabled===!1||this.enableZoom===!1||this.state!==$J.NONE)return;J.preventDefault(),this.dispatchEvent(RZ),this._handleMouseWheel(this._customWheelEvent(J)),this.dispatchEvent(YY)}function yq(J){if(this.enabled===!1)return;this._handleKeyDown(J)}function vq(J){switch(this._trackPointer(J),this._pointers.length){case 1:switch(this.touches.ONE){case o8.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(J),this.state=$J.TOUCH_ROTATE;break;case o8.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(J),this.state=$J.TOUCH_PAN;break;default:this.state=$J.NONE}break;case 2:switch(this.touches.TWO){case o8.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(J),this.state=$J.TOUCH_DOLLY_PAN;break;case o8.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(J),this.state=$J.TOUCH_DOLLY_ROTATE;break;default:this.state=$J.NONE}break;default:this.state=$J.NONE}if(this.state!==$J.NONE)this.dispatchEvent(RZ)}function fq(J){switch(this._trackPointer(J),this.state){case $J.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(J),this.update();break;case $J.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(J),this.update();break;case $J.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(J),this.update();break;case $J.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(J),this.update();break;default:this.state=$J.NONE}}function hq(J){if(this.enabled===!1)return;J.preventDefault()}function xq(J){if(J.key==="Control")this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0})}function bq(J){if(J.key==="Control")this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0})}function DZ(J,Q){if(Q===v$)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),J;if(Q===Q6||Q===T6){let $=J.getIndex();if($===null){let Y=[],X=J.getAttribute("position");if(X!==void 0){for(let K=0;K<X.count;K++)Y.push(K);J.setIndex(Y),$=J.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),J}let Z=$.count-2,W=[];if(Q===Q6)for(let Y=1;Y<=Z;Y++)W.push($.getX(0)),W.push($.getX(Y)),W.push($.getX(Y+1));else for(let Y=0;Y<Z;Y++)if(Y%2===0)W.push($.getX(Y)),W.push($.getX(Y+1)),W.push($.getX(Y+2));else W.push($.getX(Y+2)),W.push($.getX(Y+1)),W.push($.getX(Y));if(W.length/3!==Z)console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");let H=J.clone();return H.setIndex(W),H.clearGroups(),H}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",Q),J}class CZ extends p8{constructor(J){super(J);this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(Q){return new FY(Q)}),this.register(function(Q){return new OY(Q)}),this.register(function(Q){return new CY(Q)}),this.register(function(Q){return new _Y(Q)}),this.register(function(Q){return new wY(Q)}),this.register(function(Q){return new kY(Q)}),this.register(function(Q){return new DY(Q)}),this.register(function(Q){return new MY(Q)}),this.register(function(Q){return new LY(Q)}),this.register(function(Q){return new NY(Q)}),this.register(function(Q){return new VY(Q)}),this.register(function(Q){return new RY(Q)}),this.register(function(Q){return new BY(Q)}),this.register(function(Q){return new zY(Q)}),this.register(function(Q){return new qY(Q)}),this.register(function(Q){return new IY(Q)}),this.register(function(Q){return new PY(Q)})}load(J,Q,$,Z){let W=this,H;if(this.resourcePath!=="")H=this.resourcePath;else if(this.path!==""){let K=Z9.extractUrlBase(J);H=Z9.resolveURL(K,this.path)}else H=Z9.extractUrlBase(J);this.manager.itemStart(J);let Y=function(K){if(Z)Z(K);else console.error(K);W.manager.itemError(J),W.manager.itemEnd(J)},X=new g6(this.manager);X.setPath(this.path),X.setResponseType("arraybuffer"),X.setRequestHeader(this.requestHeader),X.setWithCredentials(this.withCredentials),X.load(J,function(K){try{W.parse(K,H,function(U){Q(U),W.manager.itemEnd(J)},Y)}catch(U){Y(U)}},$,Y)}setDRACOLoader(J){return this.dracoLoader=J,this}setKTX2Loader(J){return this.ktx2Loader=J,this}setMeshoptDecoder(J){return this.meshoptDecoder=J,this}register(J){if(this.pluginCallbacks.indexOf(J)===-1)this.pluginCallbacks.push(J);return this}unregister(J){if(this.pluginCallbacks.indexOf(J)!==-1)this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(J),1);return this}parse(J,Q,$,Z){let W,H={},Y={},X=new TextDecoder;if(typeof J==="string")W=JSON.parse(J);else if(J instanceof ArrayBuffer)if(X.decode(new Uint8Array(J,0,4))===TY){try{H[m0.KHR_BINARY_GLTF]=new AY(J)}catch(G){if(Z)Z(G);return}W=JSON.parse(H[m0.KHR_BINARY_GLTF].content)}else W=JSON.parse(X.decode(J));else W=J;if(W.asset===void 0||W.asset.version[0]<2){if(Z)Z(Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}let K=new fY(W,{path:Q||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});K.fileLoader.setRequestHeader(this.requestHeader);for(let U=0;U<this.pluginCallbacks.length;U++){let G=this.pluginCallbacks[U](K);if(!G.name)console.error("THREE.GLTFLoader: Invalid plugin found: missing name");Y[G.name]=G,H[G.name]=!0}if(W.extensionsUsed)for(let U=0;U<W.extensionsUsed.length;++U){let G=W.extensionsUsed[U],q=W.extensionsRequired||[];switch(G){case m0.KHR_MATERIALS_UNLIT:H[G]=new EY;break;case m0.KHR_DRACO_MESH_COMPRESSION:H[G]=new SY(W,this.dracoLoader);break;case m0.KHR_TEXTURE_TRANSFORM:H[G]=new jY;break;case m0.KHR_MESH_QUANTIZATION:H[G]=new yY;break;default:if(q.indexOf(G)>=0&&Y[G]===void 0)console.warn('THREE.GLTFLoader: Unknown extension "'+G+'".')}}K.setExtensions(H),K.setPlugins(Y),K.parse($,Z)}parseAsync(J,Q){let $=this;return new Promise(function(Z,W){$.parse(J,Q,Z,W)})}}function gq(){let J={};return{get:function(Q){return J[Q]},add:function(Q,$){J[Q]=$},remove:function(Q){delete J[Q]},removeAll:function(){J={}}}}var m0={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"};class qY{constructor(J){this.parser=J,this.name=m0.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){let J=this.parser,Q=this.parser.json.nodes||[];for(let $=0,Z=Q.length;$<Z;$++){let W=Q[$];if(W.extensions&&W.extensions[this.name]&&W.extensions[this.name].light!==void 0)J._addNodeRef(this.cache,W.extensions[this.name].light)}}_loadLight(J){let Q=this.parser,$="light:"+J,Z=Q.cache.get($);if(Z)return Z;let W=Q.json,X=((W.extensions&&W.extensions[this.name]||{}).lights||[])[J],K,U=new P0(16777215);if(X.color!==void 0)U.setRGB(X.color[0],X.color[1],X.color[2],hJ);let G=X.range!==void 0?X.range:0;switch(X.type){case"directional":K=new V9(U),K.target.position.set(0,0,-1),K.add(K.target);break;case"point":K=new WQ(U),K.distance=G;break;case"spot":K=new ZQ(U),K.distance=G,X.spot=X.spot||{},X.spot.innerConeAngle=X.spot.innerConeAngle!==void 0?X.spot.innerConeAngle:0,X.spot.outerConeAngle=X.spot.outerConeAngle!==void 0?X.spot.outerConeAngle:Math.PI/4,K.angle=X.spot.outerConeAngle,K.penumbra=1-X.spot.innerConeAngle/X.spot.outerConeAngle,K.target.position.set(0,0,-1),K.add(K.target);break;default:throw Error("THREE.GLTFLoader: Unexpected light type: "+X.type)}if(K.position.set(0,0,0),C8(K,X),X.intensity!==void 0)K.intensity=X.intensity;return K.name=Q.createUniqueName(X.name||"light_"+J),Z=Promise.resolve(K),Q.cache.add($,Z),Z}getDependency(J,Q){if(J!=="light")return;return this._loadLight(Q)}createNodeAttachment(J){let Q=this,$=this.parser,W=$.json.nodes[J],Y=(W.extensions&&W.extensions[this.name]||{}).light;if(Y===void 0)return null;return this._loadLight(Y).then(function(X){return $._getNodeRef(Q.cache,Y,X)})}}class EY{constructor(){this.name=m0.KHR_MATERIALS_UNLIT}getMaterialType(){return Z8}extendParams(J,Q,$){let Z=[];J.color=new P0(1,1,1),J.opacity=1;let W=Q.pbrMetallicRoughness;if(W){if(Array.isArray(W.baseColorFactor)){let H=W.baseColorFactor;J.color.setRGB(H[0],H[1],H[2],hJ),J.opacity=H[3]}if(W.baseColorTexture!==void 0)Z.push($.assignTexture(J,"map",W.baseColorTexture,N8))}return Promise.all(Z)}}class NY{constructor(J){this.parser=J,this.name=m0.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(J,Q){let Z=this.parser.json.materials[J];if(!Z.extensions||!Z.extensions[this.name])return Promise.resolve();let W=Z.extensions[this.name].emissiveStrength;if(W!==void 0)Q.emissiveIntensity=W;return Promise.resolve()}}class FY{constructor(J){this.parser=J,this.name=m0.KHR_MATERIALS_CLEARCOAT}getMaterialType(J){let $=this.parser.json.materials[J];if(!$.extensions||!$.extensions[this.name])return null;return iJ}extendMaterialParams(J,Q){let $=this.parser,Z=$.json.materials[J];if(!Z.extensions||!Z.extensions[this.name])return Promise.resolve();let W=[],H=Z.extensions[this.name];if(H.clearcoatFactor!==void 0)Q.clearcoat=H.clearcoatFactor;if(H.clearcoatTexture!==void 0)W.push($.assignTexture(Q,"clearcoatMap",H.clearcoatTexture));if(H.clearcoatRoughnessFactor!==void 0)Q.clearcoatRoughness=H.clearcoatRoughnessFactor;if(H.clearcoatRoughnessTexture!==void 0)W.push($.assignTexture(Q,"clearcoatRoughnessMap",H.clearcoatRoughnessTexture));if(H.clearcoatNormalTexture!==void 0){if(W.push($.assignTexture(Q,"clearcoatNormalMap",H.clearcoatNormalTexture)),H.clearcoatNormalTexture.scale!==void 0){let Y=H.clearcoatNormalTexture.scale;Q.clearcoatNormalScale=new _0(Y,Y)}}return Promise.all(W)}}class OY{constructor(J){this.parser=J,this.name=m0.KHR_MATERIALS_DISPERSION}getMaterialType(J){let $=this.parser.json.materials[J];if(!$.extensions||!$.extensions[this.name])return null;return iJ}extendMaterialParams(J,Q){let Z=this.parser.json.materials[J];if(!Z.extensions||!Z.extensions[this.name])return Promise.resolve();let W=Z.extensions[this.name];return Q.dispersion=W.dispersion!==void 0?W.dispersion:0,Promise.resolve()}}class RY{constructor(J){this.parser=J,this.name=m0.KHR_MATERIALS_IRIDESCENCE}getMaterialType(J){let $=this.parser.json.materials[J];if(!$.extensions||!$.extensions[this.name])return null;return iJ}extendMaterialParams(J,Q){let $=this.parser,Z=$.json.materials[J];if(!Z.extensions||!Z.extensions[this.name])return Promise.resolve();let W=[],H=Z.extensions[this.name];if(H.iridescenceFactor!==void 0)Q.iridescence=H.iridescenceFactor;if(H.iridescenceTexture!==void 0)W.push($.assignTexture(Q,"iridescenceMap",H.iridescenceTexture));if(H.iridescenceIor!==void 0)Q.iridescenceIOR=H.iridescenceIor;if(Q.iridescenceThicknessRange===void 0)Q.iridescenceThicknessRange=[100,400];if(H.iridescenceThicknessMinimum!==void 0)Q.iridescenceThicknessRange[0]=H.iridescenceThicknessMinimum;if(H.iridescenceThicknessMaximum!==void 0)Q.iridescenceThicknessRange[1]=H.iridescenceThicknessMaximum;if(H.iridescenceThicknessTexture!==void 0)W.push($.assignTexture(Q,"iridescenceThicknessMap",H.iridescenceThicknessTexture));return Promise.all(W)}}class kY{constructor(J){this.parser=J,this.name=m0.KHR_MATERIALS_SHEEN}getMaterialType(J){let $=this.parser.json.materials[J];if(!$.extensions||!$.extensions[this.name])return null;return iJ}extendMaterialParams(J,Q){let $=this.parser,Z=$.json.materials[J];if(!Z.extensions||!Z.extensions[this.name])return Promise.resolve();let W=[];Q.sheenColor=new P0(0,0,0),Q.sheenRoughness=0,Q.sheen=1;let H=Z.extensions[this.name];if(H.sheenColorFactor!==void 0){let Y=H.sheenColorFactor;Q.sheenColor.setRGB(Y[0],Y[1],Y[2],hJ)}if(H.sheenRoughnessFactor!==void 0)Q.sheenRoughness=H.sheenRoughnessFactor;if(H.sheenColorTexture!==void 0)W.push($.assignTexture(Q,"sheenColorMap",H.sheenColorTexture,N8));if(H.sheenRoughnessTexture!==void 0)W.push($.assignTexture(Q,"sheenRoughnessMap",H.sheenRoughnessTexture));return Promise.all(W)}}class DY{constructor(J){this.parser=J,this.name=m0.KHR_MATERIALS_TRANSMISSION}getMaterialType(J){let $=this.parser.json.materials[J];if(!$.extensions||!$.extensions[this.name])return null;return iJ}extendMaterialParams(J,Q){let $=this.parser,Z=$.json.materials[J];if(!Z.extensions||!Z.extensions[this.name])return Promise.resolve();let W=[],H=Z.extensions[this.name];if(H.transmissionFactor!==void 0)Q.transmission=H.transmissionFactor;if(H.transmissionTexture!==void 0)W.push($.assignTexture(Q,"transmissionMap",H.transmissionTexture));return Promise.all(W)}}class MY{constructor(J){this.parser=J,this.name=m0.KHR_MATERIALS_VOLUME}getMaterialType(J){let $=this.parser.json.materials[J];if(!$.extensions||!$.extensions[this.name])return null;return iJ}extendMaterialParams(J,Q){let $=this.parser,Z=$.json.materials[J];if(!Z.extensions||!Z.extensions[this.name])return Promise.resolve();let W=[],H=Z.extensions[this.name];if(Q.thickness=H.thicknessFactor!==void 0?H.thicknessFactor:0,H.thicknessTexture!==void 0)W.push($.assignTexture(Q,"thicknessMap",H.thicknessTexture));Q.attenuationDistance=H.attenuationDistance||1/0;let Y=H.attenuationColor||[1,1,1];return Q.attenuationColor=new P0().setRGB(Y[0],Y[1],Y[2],hJ),Promise.all(W)}}class LY{constructor(J){this.parser=J,this.name=m0.KHR_MATERIALS_IOR}getMaterialType(J){let $=this.parser.json.materials[J];if(!$.extensions||!$.extensions[this.name])return null;return iJ}extendMaterialParams(J,Q){let Z=this.parser.json.materials[J];if(!Z.extensions||!Z.extensions[this.name])return Promise.resolve();let W=Z.extensions[this.name];return Q.ior=W.ior!==void 0?W.ior:1.5,Promise.resolve()}}class VY{constructor(J){this.parser=J,this.name=m0.KHR_MATERIALS_SPECULAR}getMaterialType(J){let $=this.parser.json.materials[J];if(!$.extensions||!$.extensions[this.name])return null;return iJ}extendMaterialParams(J,Q){let $=this.parser,Z=$.json.materials[J];if(!Z.extensions||!Z.extensions[this.name])return Promise.resolve();let W=[],H=Z.extensions[this.name];if(Q.specularIntensity=H.specularFactor!==void 0?H.specularFactor:1,H.specularTexture!==void 0)W.push($.assignTexture(Q,"specularIntensityMap",H.specularTexture));let Y=H.specularColorFactor||[1,1,1];if(Q.specularColor=new P0().setRGB(Y[0],Y[1],Y[2],hJ),H.specularColorTexture!==void 0)W.push($.assignTexture(Q,"specularColorMap",H.specularColorTexture,N8));return Promise.all(W)}}class zY{constructor(J){this.parser=J,this.name=m0.EXT_MATERIALS_BUMP}getMaterialType(J){let $=this.parser.json.materials[J];if(!$.extensions||!$.extensions[this.name])return null;return iJ}extendMaterialParams(J,Q){let $=this.parser,Z=$.json.materials[J];if(!Z.extensions||!Z.extensions[this.name])return Promise.resolve();let W=[],H=Z.extensions[this.name];if(Q.bumpScale=H.bumpFactor!==void 0?H.bumpFactor:1,H.bumpTexture!==void 0)W.push($.assignTexture(Q,"bumpMap",H.bumpTexture));return Promise.all(W)}}class BY{constructor(J){this.parser=J,this.name=m0.KHR_MATERIALS_ANISOTROPY}getMaterialType(J){let $=this.parser.json.materials[J];if(!$.extensions||!$.extensions[this.name])return null;return iJ}extendMaterialParams(J,Q){let $=this.parser,Z=$.json.materials[J];if(!Z.extensions||!Z.extensions[this.name])return Promise.resolve();let W=[],H=Z.extensions[this.name];if(H.anisotropyStrength!==void 0)Q.anisotropy=H.anisotropyStrength;if(H.anisotropyRotation!==void 0)Q.anisotropyRotation=H.anisotropyRotation;if(H.anisotropyTexture!==void 0)W.push($.assignTexture(Q,"anisotropyMap",H.anisotropyTexture));return Promise.all(W)}}class CY{constructor(J){this.parser=J,this.name=m0.KHR_TEXTURE_BASISU}loadTexture(J){let Q=this.parser,$=Q.json,Z=$.textures[J];if(!Z.extensions||!Z.extensions[this.name])return null;let W=Z.extensions[this.name],H=Q.options.ktx2Loader;if(!H)if($.extensionsRequired&&$.extensionsRequired.indexOf(this.name)>=0)throw Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");else return null;return Q.loadTextureImage(J,W.source,H)}}class _Y{constructor(J){this.parser=J,this.name=m0.EXT_TEXTURE_WEBP}loadTexture(J){let Q=this.name,$=this.parser,Z=$.json,W=Z.textures[J];if(!W.extensions||!W.extensions[Q])return null;let H=W.extensions[Q],Y=Z.images[H.source],X=$.textureLoader;if(Y.uri){let K=$.options.manager.getHandler(Y.uri);if(K!==null)X=K}return $.loadTextureImage(J,H.source,X)}}class wY{constructor(J){this.parser=J,this.name=m0.EXT_TEXTURE_AVIF}loadTexture(J){let Q=this.name,$=this.parser,Z=$.json,W=Z.textures[J];if(!W.extensions||!W.extensions[Q])return null;let H=W.extensions[Q],Y=Z.images[H.source],X=$.textureLoader;if(Y.uri){let K=$.options.manager.getHandler(Y.uri);if(K!==null)X=K}return $.loadTextureImage(J,H.source,X)}}class IY{constructor(J){this.name=m0.EXT_MESHOPT_COMPRESSION,this.parser=J}loadBufferView(J){let Q=this.parser.json,$=Q.bufferViews[J];if($.extensions&&$.extensions[this.name]){let Z=$.extensions[this.name],W=this.parser.getDependency("buffer",Z.buffer),H=this.parser.options.meshoptDecoder;if(!H||!H.supported)if(Q.extensionsRequired&&Q.extensionsRequired.indexOf(this.name)>=0)throw Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");else return null;return W.then(function(Y){let X=Z.byteOffset||0,K=Z.byteLength||0,U=Z.count,G=Z.byteStride,q=new Uint8Array(Y,X,K);if(H.decodeGltfBufferAsync)return H.decodeGltfBufferAsync(U,G,q,Z.mode,Z.filter).then(function(E){return E.buffer});else return H.ready.then(function(){let E=new ArrayBuffer(U*G);return H.decodeGltfBuffer(new Uint8Array(E),U,G,q,Z.mode,Z.filter),E})})}else return null}}class PY{constructor(J){this.name=m0.EXT_MESH_GPU_INSTANCING,this.parser=J}createNodeMesh(J){let Q=this.parser.json,$=Q.nodes[J];if(!$.extensions||!$.extensions[this.name]||$.mesh===void 0)return null;let Z=Q.meshes[$.mesh];for(let K of Z.primitives)if(K.mode!==W8.TRIANGLES&&K.mode!==W8.TRIANGLE_STRIP&&K.mode!==W8.TRIANGLE_FAN&&K.mode!==void 0)return null;let H=$.extensions[this.name].attributes,Y=[],X={};for(let K in H)Y.push(this.parser.getDependency("accessor",H[K]).then((U)=>{return X[K]=U,X[K]}));if(Y.length<1)return null;return Y.push(this.parser.createNodeMesh(J)),Promise.all(Y).then((K)=>{let U=K.pop(),G=U.isGroup?U.children:[U],q=K[0].count,E=[];for(let O of G){let D=new j0,k=new P,N=new jJ,F=new P(1,1,1),C=new c7(O.geometry,O.material,q);for(let L=0;L<q;L++){if(X.TRANSLATION)k.fromBufferAttribute(X.TRANSLATION,L);if(X.ROTATION)N.fromBufferAttribute(X.ROTATION,L);if(X.SCALE)F.fromBufferAttribute(X.SCALE,L);C.setMatrixAt(L,D.compose(k,N,F))}for(let L in X)if(L==="_COLOR_0"){let _=X[L];C.instanceColor=new O9(_.array,_.itemSize,_.normalized)}else if(L!=="TRANSLATION"&&L!=="ROTATION"&&L!=="SCALE")O.geometry.setAttribute(L,X[L]);YJ.prototype.copy.call(C,O),this.parser.assignFinalMaterial(C),E.push(C)}if(U.isGroup)return U.clear(),U.add(...E),U;return E[0]})}}var TY="glTF",d6=12,XY={JSON:1313821514,BIN:5130562};class AY{constructor(J){this.name=m0.KHR_BINARY_GLTF,this.content=null,this.body=null;let Q=new DataView(J,0,d6),$=new TextDecoder;if(this.header={magic:$.decode(new Uint8Array(J.slice(0,4))),version:Q.getUint32(4,!0),length:Q.getUint32(8,!0)},this.header.magic!==TY)throw Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");else if(this.header.version<2)throw Error("THREE.GLTFLoader: Legacy binary file detected.");let Z=this.header.length-d6,W=new DataView(J,d6),H=0;while(H<Z){let Y=W.getUint32(H,!0);H+=4;let X=W.getUint32(H,!0);if(H+=4,X===XY.JSON){let K=new Uint8Array(J,d6+H,Y);this.content=$.decode(K)}else if(X===XY.BIN){let K=d6+H;this.body=J.slice(K,K+Y)}H+=Y}if(this.content===null)throw Error("THREE.GLTFLoader: JSON content not found.")}}class SY{constructor(J,Q){if(!Q)throw Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=m0.KHR_DRACO_MESH_COMPRESSION,this.json=J,this.dracoLoader=Q,this.dracoLoader.preload()}decodePrimitive(J,Q){let $=this.json,Z=this.dracoLoader,W=J.extensions[this.name].bufferView,H=J.extensions[this.name].attributes,Y={},X={},K={};for(let U in H){let G=zZ[U]||U.toLowerCase();Y[G]=H[U]}for(let U in J.attributes){let G=zZ[U]||U.toLowerCase();if(H[U]!==void 0){let q=$.accessors[J.attributes[U]],E=G6[q.componentType];K[G]=E.name,X[G]=q.normalized===!0}}return Q.getDependency("bufferView",W).then(function(U){return new Promise(function(G,q){Z.decodeDracoFile(U,function(E){for(let O in E.attributes){let D=E.attributes[O],k=X[O];if(k!==void 0)D.normalized=k}G(E)},Y,K,hJ,q)})})}}class jY{constructor(){this.name=m0.KHR_TEXTURE_TRANSFORM}extendTexture(J,Q){if((Q.texCoord===void 0||Q.texCoord===J.channel)&&Q.offset===void 0&&Q.rotation===void 0&&Q.scale===void 0)return J;if(J=J.clone(),Q.texCoord!==void 0)J.channel=Q.texCoord;if(Q.offset!==void 0)J.offset.fromArray(Q.offset);if(Q.rotation!==void 0)J.rotation=Q.rotation;if(Q.scale!==void 0)J.repeat.fromArray(Q.scale);return J.needsUpdate=!0,J}}class yY{constructor(){this.name=m0.KHR_MESH_QUANTIZATION}}class _Z extends e8{constructor(J,Q,$,Z){super(J,Q,$,Z)}copySampleValue_(J){let Q=this.resultBuffer,$=this.sampleValues,Z=this.valueSize,W=J*Z*3+Z;for(let H=0;H!==Z;H++)Q[H]=$[W+H];return Q}interpolate_(J,Q,$,Z){let W=this.resultBuffer,H=this.sampleValues,Y=this.valueSize,X=Y*2,K=Y*3,U=Z-Q,G=($-Q)/U,q=G*G,E=q*G,O=J*K,D=O-K,k=-2*E+3*q,N=E-q,F=1-k,C=N-q+G;for(let L=0;L!==Y;L++){let _=H[D+L+Y],j=H[D+L+X]*U,w=H[O+L+Y],S=H[O+L]*U;W[L]=F*_+C*j+k*w+N*S}return W}}var pq=new jJ;class vY extends _Z{interpolate_(J,Q,$,Z){let W=super.interpolate_(J,Q,$,Z);return pq.fromArray(W).normalize().toArray(W),W}}var W8={FLOAT:5126,FLOAT_MAT3:35675,FLOAT_MAT4:35676,FLOAT_VEC2:35664,FLOAT_VEC3:35665,FLOAT_VEC4:35666,LINEAR:9729,REPEAT:10497,SAMPLER_2D:35678,POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6,UNSIGNED_BYTE:5121,UNSIGNED_SHORT:5123},G6={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},KY={9728:f8,9729:E8,9984:A7,9985:t9,9986:k9,9987:h8},UY={33071:P7,33648:T7,10497:r9},MZ={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},zZ={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},W9={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},lq={CUBICSPLINE:void 0,LINEAR:h7,STEP:y$},LZ={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};function dq(J){if(J.DefaultMaterial===void 0)J.DefaultMaterial=new H6({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:i8});return J.DefaultMaterial}function I9(J,Q,$){for(let Z in $.extensions)if(J[Z]===void 0)Q.userData.gltfExtensions=Q.userData.gltfExtensions||{},Q.userData.gltfExtensions[Z]=$.extensions[Z]}function C8(J,Q){if(Q.extras!==void 0)if(typeof Q.extras==="object")Object.assign(J.userData,Q.extras);else console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+Q.extras)}function mq(J,Q,$){let Z=!1,W=!1,H=!1;for(let U=0,G=Q.length;U<G;U++){let q=Q[U];if(q.POSITION!==void 0)Z=!0;if(q.NORMAL!==void 0)W=!0;if(q.COLOR_0!==void 0)H=!0;if(Z&&W&&H)break}if(!Z&&!W&&!H)return Promise.resolve(J);let Y=[],X=[],K=[];for(let U=0,G=Q.length;U<G;U++){let q=Q[U];if(Z){let E=q.POSITION!==void 0?$.getDependency("accessor",q.POSITION):J.attributes.position;Y.push(E)}if(W){let E=q.NORMAL!==void 0?$.getDependency("accessor",q.NORMAL):J.attributes.normal;X.push(E)}if(H){let E=q.COLOR_0!==void 0?$.getDependency("accessor",q.COLOR_0):J.attributes.color;K.push(E)}}return Promise.all([Promise.all(Y),Promise.all(X),Promise.all(K)]).then(function(U){let G=U[0],q=U[1],E=U[2];if(Z)J.morphAttributes.position=G;if(W)J.morphAttributes.normal=q;if(H)J.morphAttributes.color=E;return J.morphTargetsRelative=!0,J})}function uq(J,Q){if(J.updateMorphTargets(),Q.weights!==void 0)for(let $=0,Z=Q.weights.length;$<Z;$++)J.morphTargetInfluences[$]=Q.weights[$];if(Q.extras&&Array.isArray(Q.extras.targetNames)){let $=Q.extras.targetNames;if(J.morphTargetInfluences.length===$.length){J.morphTargetDictionary={};for(let Z=0,W=$.length;Z<W;Z++)J.morphTargetDictionary[$[Z]]=Z}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}function cq(J){let Q,$=J.extensions&&J.extensions[m0.KHR_DRACO_MESH_COMPRESSION];if($)Q="draco:"+$.bufferView+":"+$.indices+":"+VZ($.attributes);else Q=J.indices+":"+VZ(J.attributes)+":"+J.mode;if(J.targets!==void 0)for(let Z=0,W=J.targets.length;Z<W;Z++)Q+=":"+VZ(J.targets[Z]);return Q}function VZ(J){let Q="",$=Object.keys(J).sort();for(let Z=0,W=$.length;Z<W;Z++)Q+=$[Z]+":"+J[$[Z]]+";";return Q}function BZ(J){switch(J){case Int8Array:return 0.007874015748031496;case Uint8Array:return 0.00392156862745098;case Int16Array:return 0.00003051850947599719;case Uint16Array:return 0.000015259021896696422;default:throw Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}function nq(J){if(J.search(/\.jpe?g($|\?)/i)>0||J.search(/^data\:image\/jpeg/)===0)return"image/jpeg";if(J.search(/\.webp($|\?)/i)>0||J.search(/^data\:image\/webp/)===0)return"image/webp";if(J.search(/\.ktx2($|\?)/i)>0||J.search(/^data\:image\/ktx2/)===0)return"image/ktx2";return"image/png"}var sq=new j0;class fY{constructor(J={},Q={}){this.json=J,this.extensions={},this.plugins={},this.options=Q,this.cache=new gq,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let $=!1,Z=-1,W=!1,H=-1;if(typeof navigator<"u"){let Y=navigator.userAgent;$=/^((?!chrome|android).)*safari/i.test(Y)===!0;let X=Y.match(/Version\/(\d+)/);Z=$&&X?parseInt(X[1],10):-1,W=Y.indexOf("Firefox")>-1,H=W?Y.match(/Firefox\/([0-9]+)\./)[1]:-1}if(typeof createImageBitmap>"u"||$&&Z<17||W&&H<98)this.textureLoader=new JQ(this.options.manager);else this.textureLoader=new HQ(this.options.manager);if(this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new g6(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),this.options.crossOrigin==="use-credentials")this.fileLoader.setWithCredentials(!0)}setExtensions(J){this.extensions=J}setPlugins(J){this.plugins=J}parse(J,Q){let $=this,Z=this.json,W=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(H){return H._markDefs&&H._markDefs()}),Promise.all(this._invokeAll(function(H){return H.beforeRoot&&H.beforeRoot()})).then(function(){return Promise.all([$.getDependencies("scene"),$.getDependencies("animation"),$.getDependencies("camera")])}).then(function(H){let Y={scene:H[0][Z.scene||0],scenes:H[0],animations:H[1],cameras:H[2],asset:Z.asset,parser:$,userData:{}};return I9(W,Y,Z),C8(Y,Z),Promise.all($._invokeAll(function(X){return X.afterRoot&&X.afterRoot(Y)})).then(function(){for(let X of Y.scenes)X.updateMatrixWorld();J(Y)})}).catch(Q)}_markDefs(){let J=this.json.nodes||[],Q=this.json.skins||[],$=this.json.meshes||[];for(let Z=0,W=Q.length;Z<W;Z++){let H=Q[Z].joints;for(let Y=0,X=H.length;Y<X;Y++)J[H[Y]].isBone=!0}for(let Z=0,W=J.length;Z<W;Z++){let H=J[Z];if(H.mesh!==void 0){if(this._addNodeRef(this.meshCache,H.mesh),H.skin!==void 0)$[H.mesh].isSkinnedMesh=!0}if(H.camera!==void 0)this._addNodeRef(this.cameraCache,H.camera)}}_addNodeRef(J,Q){if(Q===void 0)return;if(J.refs[Q]===void 0)J.refs[Q]=J.uses[Q]=0;J.refs[Q]++}_getNodeRef(J,Q,$){if(J.refs[Q]<=1)return $;let Z=$.clone(),W=(H,Y)=>{let X=this.associations.get(H);if(X!=null)this.associations.set(Y,X);for(let[K,U]of H.children.entries())W(U,Y.children[K])};return W($,Z),Z.name+="_instance_"+J.uses[Q]++,Z}_invokeOne(J){let Q=Object.values(this.plugins);Q.push(this);for(let $=0;$<Q.length;$++){let Z=J(Q[$]);if(Z)return Z}return null}_invokeAll(J){let Q=Object.values(this.plugins);Q.unshift(this);let $=[];for(let Z=0;Z<Q.length;Z++){let W=J(Q[Z]);if(W)$.push(W)}return $}getDependency(J,Q){let $=J+":"+Q,Z=this.cache.get($);if(!Z){switch(J){case"scene":Z=this.loadScene(Q);break;case"node":Z=this._invokeOne(function(W){return W.loadNode&&W.loadNode(Q)});break;case"mesh":Z=this._invokeOne(function(W){return W.loadMesh&&W.loadMesh(Q)});break;case"accessor":Z=this.loadAccessor(Q);break;case"bufferView":Z=this._invokeOne(function(W){return W.loadBufferView&&W.loadBufferView(Q)});break;case"buffer":Z=this.loadBuffer(Q);break;case"material":Z=this._invokeOne(function(W){return W.loadMaterial&&W.loadMaterial(Q)});break;case"texture":Z=this._invokeOne(function(W){return W.loadTexture&&W.loadTexture(Q)});break;case"skin":Z=this.loadSkin(Q);break;case"animation":Z=this._invokeOne(function(W){return W.loadAnimation&&W.loadAnimation(Q)});break;case"camera":Z=this.loadCamera(Q);break;default:if(Z=this._invokeOne(function(W){return W!=this&&W.getDependency&&W.getDependency(J,Q)}),!Z)throw Error("Unknown type: "+J);break}this.cache.add($,Z)}return Z}getDependencies(J){let Q=this.cache.get(J);if(!Q){let $=this,Z=this.json[J+(J==="mesh"?"es":"s")]||[];Q=Promise.all(Z.map(function(W,H){return $.getDependency(J,H)})),this.cache.add(J,Q)}return Q}loadBuffer(J){let Q=this.json.buffers[J],$=this.fileLoader;if(Q.type&&Q.type!=="arraybuffer")throw Error("THREE.GLTFLoader: "+Q.type+" buffer type is not supported.");if(Q.uri===void 0&&J===0)return Promise.resolve(this.extensions[m0.KHR_BINARY_GLTF].body);let Z=this.options;return new Promise(function(W,H){$.load(Z9.resolveURL(Q.uri,Z.path),W,void 0,function(){H(Error('THREE.GLTFLoader: Failed to load buffer "'+Q.uri+'".'))})})}loadBufferView(J){let Q=this.json.bufferViews[J];return this.getDependency("buffer",Q.buffer).then(function($){let Z=Q.byteLength||0,W=Q.byteOffset||0;return $.slice(W,W+Z)})}loadAccessor(J){let Q=this,$=this.json,Z=this.json.accessors[J];if(Z.bufferView===void 0&&Z.sparse===void 0){let H=MZ[Z.type],Y=G6[Z.componentType],X=Z.normalized===!0,K=new Y(Z.count*H);return Promise.resolve(new MJ(K,H,X))}let W=[];if(Z.bufferView!==void 0)W.push(this.getDependency("bufferView",Z.bufferView));else W.push(null);if(Z.sparse!==void 0)W.push(this.getDependency("bufferView",Z.sparse.indices.bufferView)),W.push(this.getDependency("bufferView",Z.sparse.values.bufferView));return Promise.all(W).then(function(H){let Y=H[0],X=MZ[Z.type],K=G6[Z.componentType],U=K.BYTES_PER_ELEMENT,G=U*X,q=Z.byteOffset||0,E=Z.bufferView!==void 0?$.bufferViews[Z.bufferView].byteStride:void 0,O=Z.normalized===!0,D,k;if(E&&E!==G){let N=Math.floor(q/E),F="InterleavedBuffer:"+Z.bufferView+":"+Z.componentType+":"+N+":"+Z.count,C=Q.cache.get(F);if(!C)D=new K(Y,N*E,Z.count*E/U),C=new y6(D,E/U),Q.cache.add(F,C);k=new Z6(C,X,q%E/U,O)}else{if(Y===null)D=new K(Z.count*X);else D=new K(Y,q,Z.count*X);k=new MJ(D,X,O)}if(Z.sparse!==void 0){let N=MZ.SCALAR,F=G6[Z.sparse.indices.componentType],C=Z.sparse.indices.byteOffset||0,L=Z.sparse.values.byteOffset||0,_=new F(H[1],C,Z.sparse.count*N),j=new K(H[2],L,Z.sparse.count*X);if(Y!==null)k=new MJ(k.array.slice(),k.itemSize,k.normalized);k.normalized=!1;for(let w=0,S=_.length;w<S;w++){let p=_[w];if(k.setX(p,j[w*X]),X>=2)k.setY(p,j[w*X+1]);if(X>=3)k.setZ(p,j[w*X+2]);if(X>=4)k.setW(p,j[w*X+3]);if(X>=5)throw Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}k.normalized=O}return k})}loadTexture(J){let Q=this.json,$=this.options,W=Q.textures[J].source,H=Q.images[W],Y=this.textureLoader;if(H.uri){let X=$.manager.getHandler(H.uri);if(X!==null)Y=X}return this.loadTextureImage(J,W,Y)}loadTextureImage(J,Q,$){let Z=this,W=this.json,H=W.textures[J],Y=W.images[Q],X=(Y.uri||Y.bufferView)+":"+H.sampler;if(this.textureCache[X])return this.textureCache[X];let K=this.loadImageSource(Q,$).then(function(U){if(U.flipY=!1,U.name=H.name||Y.name||"",U.name===""&&typeof Y.uri==="string"&&Y.uri.startsWith("data:image/")===!1)U.name=Y.uri;let q=(W.samplers||{})[H.sampler]||{};return U.magFilter=KY[q.magFilter]||E8,U.minFilter=KY[q.minFilter]||h8,U.wrapS=UY[q.wrapS]||r9,U.wrapT=UY[q.wrapT]||r9,U.generateMipmaps=!U.isCompressedTexture&&U.minFilter!==f8&&U.minFilter!==E8,Z.associations.set(U,{textures:J}),U}).catch(function(){return null});return this.textureCache[X]=K,K}loadImageSource(J,Q){let $=this,Z=this.json,W=this.options;if(this.sourceCache[J]!==void 0)return this.sourceCache[J].then((G)=>G.clone());let H=Z.images[J],Y=self.URL||self.webkitURL,X=H.uri||"",K=!1;if(H.bufferView!==void 0)X=$.getDependency("bufferView",H.bufferView).then(function(G){K=!0;let q=new Blob([G],{type:H.mimeType});return X=Y.createObjectURL(q),X});else if(H.uri===void 0)throw Error("THREE.GLTFLoader: Image "+J+" is missing URI and bufferView");let U=Promise.resolve(X).then(function(G){return new Promise(function(q,E){let O=q;if(Q.isImageBitmapLoader===!0)O=function(D){let k=new kJ(D);k.needsUpdate=!0,q(k)};Q.load(Z9.resolveURL(G,W.path),O,void 0,E)})}).then(function(G){if(K===!0)Y.revokeObjectURL(X);return C8(G,H),G.userData.mimeType=H.mimeType||nq(H.uri),G}).catch(function(G){throw console.error("THREE.GLTFLoader: Couldn't load texture",X),G});return this.sourceCache[J]=U,U}assignTexture(J,Q,$,Z){let W=this;return this.getDependency("texture",$.index).then(function(H){if(!H)return null;if($.texCoord!==void 0&&$.texCoord>0)H=H.clone(),H.channel=$.texCoord;if(W.extensions[m0.KHR_TEXTURE_TRANSFORM]){let Y=$.extensions!==void 0?$.extensions[m0.KHR_TEXTURE_TRANSFORM]:void 0;if(Y){let X=W.associations.get(H);H=W.extensions[m0.KHR_TEXTURE_TRANSFORM].extendTexture(H,Y),W.associations.set(H,X)}}if(Z!==void 0)H.colorSpace=Z;return J[Q]=H,H})}assignFinalMaterial(J){let{geometry:Q,material:$}=J,Z=Q.attributes.tangent===void 0,W=Q.attributes.color!==void 0,H=Q.attributes.normal===void 0;if(J.isPoints){let Y="PointsMaterial:"+$.uuid,X=this.cache.get(Y);if(!X)X=new b6,sJ.prototype.copy.call(X,$),X.color.copy($.color),X.map=$.map,X.sizeAttenuation=!1,this.cache.add(Y,X);$=X}else if(J.isLine){let Y="LineBasicMaterial:"+$.uuid,X=this.cache.get(Y);if(!X)X=new x6,sJ.prototype.copy.call(X,$),X.color.copy($.color),X.map=$.map,this.cache.add(Y,X);$=X}if(Z||W||H){let Y="ClonedMaterial:"+$.uuid+":";if(Z)Y+="derivative-tangents:";if(W)Y+="vertex-colors:";if(H)Y+="flat-shading:";let X=this.cache.get(Y);if(!X){if(X=$.clone(),W)X.vertexColors=!0;if(H)X.flatShading=!0;if(Z){if(X.normalScale)X.normalScale.y*=-1;if(X.clearcoatNormalScale)X.clearcoatNormalScale.y*=-1}this.cache.add(Y,X),this.associations.set(X,this.associations.get($))}$=X}J.material=$}getMaterialType(){return H6}loadMaterial(J){let Q=this,$=this.json,Z=this.extensions,W=$.materials[J],H,Y={},X=W.extensions||{},K=[];if(X[m0.KHR_MATERIALS_UNLIT]){let G=Z[m0.KHR_MATERIALS_UNLIT];H=G.getMaterialType(),K.push(G.extendParams(Y,W,Q))}else{let G=W.pbrMetallicRoughness||{};if(Y.color=new P0(1,1,1),Y.opacity=1,Array.isArray(G.baseColorFactor)){let q=G.baseColorFactor;Y.color.setRGB(q[0],q[1],q[2],hJ),Y.opacity=q[3]}if(G.baseColorTexture!==void 0)K.push(Q.assignTexture(Y,"map",G.baseColorTexture,N8));if(Y.metalness=G.metallicFactor!==void 0?G.metallicFactor:1,Y.roughness=G.roughnessFactor!==void 0?G.roughnessFactor:1,G.metallicRoughnessTexture!==void 0)K.push(Q.assignTexture(Y,"metalnessMap",G.metallicRoughnessTexture)),K.push(Q.assignTexture(Y,"roughnessMap",G.metallicRoughnessTexture));H=this._invokeOne(function(q){return q.getMaterialType&&q.getMaterialType(J)}),K.push(Promise.all(this._invokeAll(function(q){return q.extendMaterialParams&&q.extendMaterialParams(J,Y)})))}if(W.doubleSided===!0)Y.side=$8;let U=W.alphaMode||LZ.OPAQUE;if(U===LZ.BLEND)Y.transparent=!0,Y.depthWrite=!1;else if(Y.transparent=!1,U===LZ.MASK)Y.alphaTest=W.alphaCutoff!==void 0?W.alphaCutoff:0.5;if(W.normalTexture!==void 0&&H!==Z8){if(K.push(Q.assignTexture(Y,"normalMap",W.normalTexture)),Y.normalScale=new _0(1,1),W.normalTexture.scale!==void 0){let G=W.normalTexture.scale;Y.normalScale.set(G,G)}}if(W.occlusionTexture!==void 0&&H!==Z8){if(K.push(Q.assignTexture(Y,"aoMap",W.occlusionTexture)),W.occlusionTexture.strength!==void 0)Y.aoMapIntensity=W.occlusionTexture.strength}if(W.emissiveFactor!==void 0&&H!==Z8){let G=W.emissiveFactor;Y.emissive=new P0().setRGB(G[0],G[1],G[2],hJ)}if(W.emissiveTexture!==void 0&&H!==Z8)K.push(Q.assignTexture(Y,"emissiveMap",W.emissiveTexture,N8));return Promise.all(K).then(function(){let G=new H(Y);if(W.name)G.name=W.name;if(C8(G,W),Q.associations.set(G,{materials:J}),W.extensions)I9(Z,G,W);return G})}createUniqueName(J){let Q=r0.sanitizeNodeName(J||"");if(Q in this.nodeNamesUsed)return Q+"_"+ ++this.nodeNamesUsed[Q];else return this.nodeNamesUsed[Q]=0,Q}loadGeometries(J){let Q=this,$=this.extensions,Z=this.primitiveCache;function W(Y){return $[m0.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(Y,Q).then(function(X){return GY(X,Y,Q)})}let H=[];for(let Y=0,X=J.length;Y<X;Y++){let K=J[Y],U=cq(K),G=Z[U];if(G)H.push(G.promise);else{let q;if(K.extensions&&K.extensions[m0.KHR_DRACO_MESH_COMPRESSION])q=W(K);else q=GY(new oJ,K,Q);Z[U]={primitive:K,promise:q},H.push(q)}}return Promise.all(H)}loadMesh(J){let Q=this,$=this.json,Z=this.extensions,W=$.meshes[J],H=W.primitives,Y=[];for(let X=0,K=H.length;X<K;X++){let U=H[X].material===void 0?dq(this.cache):this.getDependency("material",H[X].material);Y.push(U)}return Y.push(Q.loadGeometries(H)),Promise.all(Y).then(function(X){let K=X.slice(0,X.length-1),U=X[X.length-1],G=[];for(let E=0,O=U.length;E<O;E++){let D=U[E],k=H[E],N,F=K[E];if(k.mode===W8.TRIANGLES||k.mode===W8.TRIANGLE_STRIP||k.mode===W8.TRIANGLE_FAN||k.mode===void 0){if(N=W.isSkinnedMesh===!0?new m7(D,F):new IJ(D,F),N.isSkinnedMesh===!0)N.normalizeSkinWeights();if(k.mode===W8.TRIANGLE_STRIP)N.geometry=DZ(N.geometry,T6);else if(k.mode===W8.TRIANGLE_FAN)N.geometry=DZ(N.geometry,Q6)}else if(k.mode===W8.LINES)N=new n7(D,F);else if(k.mode===W8.LINE_STRIP)N=new W6(D,F);else if(k.mode===W8.LINE_LOOP)N=new s7(D,F);else if(k.mode===W8.POINTS)N=new o7(D,F);else throw Error("THREE.GLTFLoader: Primitive mode unsupported: "+k.mode);if(Object.keys(N.geometry.morphAttributes).length>0)uq(N,W);if(N.name=Q.createUniqueName(W.name||"mesh_"+J),C8(N,W),k.extensions)I9(Z,N,k);Q.assignFinalMaterial(N),G.push(N)}for(let E=0,O=G.length;E<O;E++)Q.associations.set(G[E],{meshes:J,primitives:E});if(G.length===1){if(W.extensions)I9(Z,G[0],W);return G[0]}let q=new D8;if(W.extensions)I9(Z,q,W);Q.associations.set(q,{meshes:J});for(let E=0,O=G.length;E<O;E++)q.add(G[E]);return q})}loadCamera(J){let Q,$=this.json.cameras[J],Z=$[$.type];if(!Z){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}if($.type==="perspective")Q=new TJ(cJ.radToDeg(Z.yfov),Z.aspectRatio||1,Z.znear||1,Z.zfar||2000000);else if($.type==="orthographic")Q=new $9(-Z.xmag,Z.xmag,Z.ymag,-Z.ymag,Z.znear,Z.zfar);if($.name)Q.name=this.createUniqueName($.name);return C8(Q,$),Promise.resolve(Q)}loadSkin(J){let Q=this.json.skins[J],$=[];for(let Z=0,W=Q.joints.length;Z<W;Z++)$.push(this._loadNodeShallow(Q.joints[Z]));if(Q.inverseBindMatrices!==void 0)$.push(this.getDependency("accessor",Q.inverseBindMatrices));else $.push(null);return Promise.all($).then(function(Z){let W=Z.pop(),H=Z,Y=[],X=[];for(let K=0,U=H.length;K<U;K++){let G=H[K];if(G){Y.push(G);let q=new j0;if(W!==null)q.fromArray(W.array,K*16);X.push(q)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',Q.joints[K])}return new f6(Y,X)})}loadAnimation(J){let Q=this.json,$=this,Z=Q.animations[J],W=Z.name?Z.name:"animation_"+J,H=[],Y=[],X=[],K=[],U=[];for(let G=0,q=Z.channels.length;G<q;G++){let E=Z.channels[G],O=Z.samplers[E.sampler],D=E.target,k=D.node,N=Z.parameters!==void 0?Z.parameters[O.input]:O.input,F=Z.parameters!==void 0?Z.parameters[O.output]:O.output;if(D.node===void 0)continue;H.push(this.getDependency("node",k)),Y.push(this.getDependency("accessor",N)),X.push(this.getDependency("accessor",F)),K.push(O),U.push(D)}return Promise.all([Promise.all(H),Promise.all(Y),Promise.all(X),Promise.all(K),Promise.all(U)]).then(function(G){let q=G[0],E=G[1],O=G[2],D=G[3],k=G[4],N=[];for(let C=0,L=q.length;C<L;C++){let _=q[C],j=E[C],w=O[C],S=D[C],p=k[C];if(_===void 0)continue;if(_.updateMatrix)_.updateMatrix();let z=$._createAnimationTracks(_,j,w,S,p);if(z)for(let V=0;V<z.length;V++)N.push(z[V])}let F=new e7(W,void 0,N);return C8(F,Z),F})}createNodeMesh(J){let Q=this.json,$=this,Z=Q.nodes[J];if(Z.mesh===void 0)return null;return $.getDependency("mesh",Z.mesh).then(function(W){let H=$._getNodeRef($.meshCache,Z.mesh,W);if(Z.weights!==void 0)H.traverse(function(Y){if(!Y.isMesh)return;for(let X=0,K=Z.weights.length;X<K;X++)Y.morphTargetInfluences[X]=Z.weights[X]});return H})}loadNode(J){let Q=this.json,$=this,Z=Q.nodes[J],W=$._loadNodeShallow(J),H=[],Y=Z.children||[];for(let K=0,U=Y.length;K<U;K++)H.push($.getDependency("node",Y[K]));let X=Z.skin===void 0?Promise.resolve(null):$.getDependency("skin",Z.skin);return Promise.all([W,Promise.all(H),X]).then(function(K){let U=K[0],G=K[1],q=K[2];if(q!==null)U.traverse(function(E){if(!E.isSkinnedMesh)return;E.bind(q,sq)});for(let E=0,O=G.length;E<O;E++)U.add(G[E]);return U})}_loadNodeShallow(J){let Q=this.json,$=this.extensions,Z=this;if(this.nodeCache[J]!==void 0)return this.nodeCache[J];let W=Q.nodes[J],H=W.name?Z.createUniqueName(W.name):"",Y=[],X=Z._invokeOne(function(K){return K.createNodeMesh&&K.createNodeMesh(J)});if(X)Y.push(X);if(W.camera!==void 0)Y.push(Z.getDependency("camera",W.camera).then(function(K){return Z._getNodeRef(Z.cameraCache,W.camera,K)}));return Z._invokeAll(function(K){return K.createNodeAttachment&&K.createNodeAttachment(J)}).forEach(function(K){Y.push(K)}),this.nodeCache[J]=Promise.all(Y).then(function(K){let U;if(W.isBone===!0)U=new v6;else if(K.length>1)U=new D8;else if(K.length===1)U=K[0];else U=new YJ;if(U!==K[0])for(let G=0,q=K.length;G<q;G++)U.add(K[G]);if(W.name)U.userData.name=W.name,U.name=H;if(C8(U,W),W.extensions)I9($,U,W);if(W.matrix!==void 0){let G=new j0;G.fromArray(W.matrix),U.applyMatrix4(G)}else{if(W.translation!==void 0)U.position.fromArray(W.translation);if(W.rotation!==void 0)U.quaternion.fromArray(W.rotation);if(W.scale!==void 0)U.scale.fromArray(W.scale)}if(!Z.associations.has(U))Z.associations.set(U,{});else if(W.mesh!==void 0&&Z.meshCache.refs[W.mesh]>1){let G=Z.associations.get(U);Z.associations.set(U,{...G})}return Z.associations.get(U).nodes=J,U}),this.nodeCache[J]}loadScene(J){let Q=this.extensions,$=this.json.scenes[J],Z=this,W=new D8;if($.name)W.name=Z.createUniqueName($.name);if(C8(W,$),$.extensions)I9(Q,W,$);let H=$.nodes||[],Y=[];for(let X=0,K=H.length;X<K;X++)Y.push(Z.getDependency("node",H[X]));return Promise.all(Y).then(function(X){for(let U=0,G=X.length;U<G;U++)W.add(X[U]);let K=(U)=>{let G=new Map;for(let[q,E]of Z.associations)if(q instanceof sJ||q instanceof kJ)G.set(q,E);return U.traverse((q)=>{let E=Z.associations.get(q);if(E!=null)G.set(q,E)}),G};return Z.associations=K(W),W})}_createAnimationTracks(J,Q,$,Z,W){let H=[],Y=J.name?J.name:J.uuid,X=[];if(W9[W.path]===W9.weights)J.traverse(function(q){if(q.morphTargetInfluences)X.push(q.name?q.name:q.uuid)});else X.push(Y);let K;switch(W9[W.path]){case W9.weights:K=j8;break;case W9.rotation:K=g8;break;case W9.translation:case W9.scale:K=y8;break;default:switch($.itemSize){case 1:K=j8;break;case 2:case 3:default:K=y8;break}break}let U=Z.interpolation!==void 0?lq[Z.interpolation]:h7,G=this._getArrayFromAccessor($);for(let q=0,E=X.length;q<E;q++){let O=new K(X[q]+"."+W9[W.path],Q.array,G,U);if(Z.interpolation==="CUBICSPLINE")this._createCubicSplineTrackInterpolant(O);H.push(O)}return H}_getArrayFromAccessor(J){let Q=J.array;if(J.normalized){let $=BZ(Q.constructor),Z=new Float32Array(Q.length);for(let W=0,H=Q.length;W<H;W++)Z[W]=Q[W]*$;Q=Z}return Q}_createCubicSplineTrackInterpolant(J){J.createInterpolant=function($){return new(this instanceof g8?vY:_Z)(this.times,this.values,this.getValueSize()/3,$)},J.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}}function oq(J,Q,$){let Z=Q.attributes,W=new wJ;if(Z.POSITION!==void 0){let X=$.json.accessors[Z.POSITION],K=X.min,U=X.max;if(K!==void 0&&U!==void 0){if(W.set(new P(K[0],K[1],K[2]),new P(U[0],U[1],U[2])),X.normalized){let G=BZ(G6[X.componentType]);W.min.multiplyScalar(G),W.max.multiplyScalar(G)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}else return;let H=Q.targets;if(H!==void 0){let X=new P,K=new P;for(let U=0,G=H.length;U<G;U++){let q=H[U];if(q.POSITION!==void 0){let E=$.json.accessors[q.POSITION],O=E.min,D=E.max;if(O!==void 0&&D!==void 0){if(K.setX(Math.max(Math.abs(O[0]),Math.abs(D[0]))),K.setY(Math.max(Math.abs(O[1]),Math.abs(D[1]))),K.setZ(Math.max(Math.abs(O[2]),Math.abs(D[2]))),E.normalized){let k=BZ(G6[E.componentType]);K.multiplyScalar(k)}X.max(K)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}W.expandByVector(X)}J.boundingBox=W;let Y=new nJ;W.getCenter(Y.center),Y.radius=W.min.distanceTo(W.max)/2,J.boundingSphere=Y}function GY(J,Q,$){let Z=Q.attributes,W=[];function H(Y,X){return $.getDependency("accessor",Y).then(function(K){J.setAttribute(X,K)})}for(let Y in Z){let X=zZ[Y]||Y.toLowerCase();if(X in J.attributes)continue;W.push(H(Z[Y],X))}if(Q.indices!==void 0&&!J.index){let Y=$.getDependency("accessor",Q.indices).then(function(X){J.setIndex(X)});W.push(Y)}if(n0.workingColorSpace!==hJ&&"COLOR_0"in Z)console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${n0.workingColorSpace}" not supported.`);return C8(J,Q),oq(J,Q,$),Promise.all(W).then(function(){return Q.targets!==void 0?mq(J,Q.targets,$):J})}var o0={c:null,u:[new P,new P,new P],e:[]},t0={c:null,u:[new P,new P,new P],e:[]},FJ=[[],[],[]],g0=[[],[],[]],UJ=[],P9=new P,T9=new P,A9=new P,BJ=new P,hY=new P,xY=new P,O8=new f0,bY=new wJ,NQ=new j0,gY=new j0,pY=new F8;class FQ{constructor(J=new P,Q=new P,$=new f0){this.center=J,this.halfSize=Q,this.rotation=$}set(J,Q,$){return this.center=J,this.halfSize=Q,this.rotation=$,this}copy(J){return this.center.copy(J.center),this.halfSize.copy(J.halfSize),this.rotation.copy(J.rotation),this}clone(){return new this.constructor().copy(this)}getSize(J){return J.copy(this.halfSize).multiplyScalar(2)}clampPoint(J,Q){let $=this.halfSize;BJ.subVectors(J,this.center),this.rotation.extractBasis(P9,T9,A9),Q.copy(this.center);let Z=cJ.clamp(BJ.dot(P9),-$.x,$.x);Q.add(P9.multiplyScalar(Z));let W=cJ.clamp(BJ.dot(T9),-$.y,$.y);Q.add(T9.multiplyScalar(W));let H=cJ.clamp(BJ.dot(A9),-$.z,$.z);return Q.add(A9.multiplyScalar(H)),Q}containsPoint(J){return BJ.subVectors(J,this.center),this.rotation.extractBasis(P9,T9,A9),Math.abs(BJ.dot(P9))<=this.halfSize.x&&Math.abs(BJ.dot(T9))<=this.halfSize.y&&Math.abs(BJ.dot(A9))<=this.halfSize.z}intersectsBox3(J){return this.intersectsOBB(iq.fromBox3(J))}intersectsSphere(J){return this.clampPoint(J.center,xY),xY.distanceToSquared(J.center)<=J.radius*J.radius}intersectsOBB(J,Q=Number.EPSILON){o0.c=this.center,o0.e[0]=this.halfSize.x,o0.e[1]=this.halfSize.y,o0.e[2]=this.halfSize.z,this.rotation.extractBasis(o0.u[0],o0.u[1],o0.u[2]),t0.c=J.center,t0.e[0]=J.halfSize.x,t0.e[1]=J.halfSize.y,t0.e[2]=J.halfSize.z,J.rotation.extractBasis(t0.u[0],t0.u[1],t0.u[2]);for(let W=0;W<3;W++)for(let H=0;H<3;H++)FJ[W][H]=o0.u[W].dot(t0.u[H]);BJ.subVectors(t0.c,o0.c),UJ[0]=BJ.dot(o0.u[0]),UJ[1]=BJ.dot(o0.u[1]),UJ[2]=BJ.dot(o0.u[2]);for(let W=0;W<3;W++)for(let H=0;H<3;H++)g0[W][H]=Math.abs(FJ[W][H])+Q;let $,Z;for(let W=0;W<3;W++)if($=o0.e[W],Z=t0.e[0]*g0[W][0]+t0.e[1]*g0[W][1]+t0.e[2]*g0[W][2],Math.abs(UJ[W])>$+Z)return!1;for(let W=0;W<3;W++)if($=o0.e[0]*g0[0][W]+o0.e[1]*g0[1][W]+o0.e[2]*g0[2][W],Z=t0.e[W],Math.abs(UJ[0]*FJ[0][W]+UJ[1]*FJ[1][W]+UJ[2]*FJ[2][W])>$+Z)return!1;if($=o0.e[1]*g0[2][0]+o0.e[2]*g0[1][0],Z=t0.e[1]*g0[0][2]+t0.e[2]*g0[0][1],Math.abs(UJ[2]*FJ[1][0]-UJ[1]*FJ[2][0])>$+Z)return!1;if($=o0.e[1]*g0[2][1]+o0.e[2]*g0[1][1],Z=t0.e[0]*g0[0][2]+t0.e[2]*g0[0][0],Math.abs(UJ[2]*FJ[1][1]-UJ[1]*FJ[2][1])>$+Z)return!1;if($=o0.e[1]*g0[2][2]+o0.e[2]*g0[1][2],Z=t0.e[0]*g0[0][1]+t0.e[1]*g0[0][0],Math.abs(UJ[2]*FJ[1][2]-UJ[1]*FJ[2][2])>$+Z)return!1;if($=o0.e[0]*g0[2][0]+o0.e[2]*g0[0][0],Z=t0.e[1]*g0[1][2]+t0.e[2]*g0[1][1],Math.abs(UJ[0]*FJ[2][0]-UJ[2]*FJ[0][0])>$+Z)return!1;if($=o0.e[0]*g0[2][1]+o0.e[2]*g0[0][1],Z=t0.e[0]*g0[1][2]+t0.e[2]*g0[1][0],Math.abs(UJ[0]*FJ[2][1]-UJ[2]*FJ[0][1])>$+Z)return!1;if($=o0.e[0]*g0[2][2]+o0.e[2]*g0[0][2],Z=t0.e[0]*g0[1][1]+t0.e[1]*g0[1][0],Math.abs(UJ[0]*FJ[2][2]-UJ[2]*FJ[0][2])>$+Z)return!1;if($=o0.e[0]*g0[1][0]+o0.e[1]*g0[0][0],Z=t0.e[1]*g0[2][2]+t0.e[2]*g0[2][1],Math.abs(UJ[1]*FJ[0][0]-UJ[0]*FJ[1][0])>$+Z)return!1;if($=o0.e[0]*g0[1][1]+o0.e[1]*g0[0][1],Z=t0.e[0]*g0[2][2]+t0.e[2]*g0[2][0],Math.abs(UJ[1]*FJ[0][1]-UJ[0]*FJ[1][1])>$+Z)return!1;if($=o0.e[0]*g0[1][2]+o0.e[1]*g0[0][2],Z=t0.e[0]*g0[2][1]+t0.e[1]*g0[2][0],Math.abs(UJ[1]*FJ[0][2]-UJ[0]*FJ[1][2])>$+Z)return!1;return!0}intersectsPlane(J){this.rotation.extractBasis(P9,T9,A9);let Q=this.halfSize.x*Math.abs(J.normal.dot(P9))+this.halfSize.y*Math.abs(J.normal.dot(T9))+this.halfSize.z*Math.abs(J.normal.dot(A9)),$=J.normal.dot(this.center)-J.constant;return Math.abs($)<=Q}intersectRay(J,Q){if(this.getSize(hY),bY.setFromCenterAndSize(BJ.set(0,0,0),hY),NQ.setFromMatrix3(this.rotation),NQ.setPosition(this.center),gY.copy(NQ).invert(),pY.copy(J).applyMatrix4(gY),pY.intersectBox(bY,Q))return Q.applyMatrix4(NQ);else return null}intersectsRay(J){return this.intersectRay(J,BJ)!==null}fromBox3(J){return J.getCenter(this.center),J.getSize(this.halfSize).multiplyScalar(0.5),this.rotation.identity(),this}equals(J){return J.center.equals(this.center)&&J.halfSize.equals(this.halfSize)&&J.rotation.equals(this.rotation)}applyMatrix4(J){let Q=J.elements,$=BJ.set(Q[0],Q[1],Q[2]).length(),Z=BJ.set(Q[4],Q[5],Q[6]).length(),W=BJ.set(Q[8],Q[9],Q[10]).length();if(J.determinant()<0)$=-$;O8.setFromMatrix4(J);let Y=1/$,X=1/Z,K=1/W;return O8.elements[0]*=Y,O8.elements[1]*=Y,O8.elements[2]*=Y,O8.elements[3]*=X,O8.elements[4]*=X,O8.elements[5]*=X,O8.elements[6]*=K,O8.elements[7]*=K,O8.elements[8]*=K,this.rotation.multiply(O8),this.halfSize.x*=$,this.halfSize.y*=Z,this.halfSize.z*=W,BJ.setFromMatrixPosition(J),this.center.add(BJ),this}}var iq=new FQ;var dY=0.008;function lY(J){J.updateWorldMatrix(!0,!0);let Q=J.matrixWorld.clone().invert(),$=new wJ;J.traverse((X)=>{if(!X.isMesh)return;X.geometry.computeBoundingBox(),$.union(X.geometry.boundingBox.clone().applyMatrix4(new j0().multiplyMatrices(Q,X.matrixWorld)))});let Z=$.getCenter(new P),W=$.getSize(new P).multiplyScalar(0.5),H=new FQ,Y=()=>{return J.updateWorldMatrix(!0,!1),H.set(new P,W.clone(),new f0).applyMatrix4(J.matrixWorld),H.center.copy(Z).applyMatrix4(J.matrixWorld),H};return{object:J,update:Y,box:Y()}}function aq(J,Q){let $=[new P,new P,new P],Z=[new P,new P,new P];J.rotation.extractBasis(...$),Q.rotation.extractBasis(...Z);let W=[...$,...Z];for(let G of $)for(let q of Z)W.push(new P().crossVectors(G,q));let H=J.center.clone().sub(Q.center),Y=J.halfSize.toArray(),X=Q.halfSize.toArray(),K=-1/0,U=1/0;for(let G of W){if(G.lengthSq()<0.000000000001)continue;G.normalize();let q=dY;for(let N=0;N<3;N++)q+=Math.abs(G.dot($[N]))*Y[N]+Math.abs(G.dot(Z[N]))*X[N];let E=H.dot(G),O=G.z;if(Math.abs(O)<0.00000001){if(Math.abs(E)>q)return null;continue}let D=(-q-E)/O,k=(q-E)/O;if(K=Math.max(K,Math.min(D,k)),U=Math.min(U,Math.max(D,k)),K>U)return null}return{enter:K,exit:U}}function mY(J,Q){let $=J.map(lY),Z=Q.map(lY);function W(){let Y=Z.map((X)=>X.update());$.forEach((X)=>X.update());for(let X of $){let U=[...Y,...$.filter((q)=>q!==X).map((q)=>q.box)].map((q)=>aq(X.box,q)).filter(Boolean).sort((q,E)=>q.enter-E.enter),G=0;for(let q of U){if(q.enter>G)break;if(q.exit>=G)G=q.exit+dY}if(G>0){let q=X.object.getWorldPosition(new P);q.z+=G,X.object.position.copy(X.object.parent.worldToLocal(q)),X.update()}}}function H(){let Y=Z.map((X)=>X.update());return $.forEach((X)=>X.update()),$.some((X,K)=>[...Y,...$.slice(K+1).map((U)=>U.box)].some((U)=>X.box.intersectsOBB(U)))}return{resolve:W,overlaps:H}}var OQ=(J)=>1-(1-J)**3,rq=new P(1,0,0);function uY(J,Q,$,Z,W){J.forEach((H,Y)=>{if(!$.includes(H))return;H.quaternion.copy(Q[Y].quaternion).multiply(new jJ().setFromAxisAngle(rq,W?0:OQ(Z)*Math.PI*2)),H.position.copy(Q[Y].position),H.position.y+=W?0:Math.sin(Z*Math.PI)*0.65})}function cY(J,Q,$,Z,W){J.forEach((H,Y)=>{let X=Q[Y],K=X.scale.y*(Z?1.35:1);H.scale.y=cJ.lerp($[Y],K,OQ(W)),H.position.y=X.position.y+X.height*(H.scale.y/X.scale.y-1)/2})}var H9=document.querySelector(".scene-view"),RQ=document.querySelector(".scene-controls"),Y9=document.querySelector("#scene-status"),wZ=matchMedia("(prefers-reduced-motion: reduce)"),q6=new d7,X9=new $9(-2.725,2.725,2.725,-2.725,0.1,100);X9.position.set(-2.7,5.3,12);var tq=X9.position.clone(),gJ;try{gJ=new FZ({alpha:!0,antialias:!0,powerPreference:"low-power"})}catch{Y9.textContent="3D is unavailable in this browser. The Blender render is shown instead."}if(gJ)eq().catch(()=>{gJ.dispose(),gJ.domElement.remove(),H9.classList.remove("scene-ready"),RQ.hidden=!0,Y9.textContent="3D could not load. The Blender render is shown instead."});async function eq(){gJ.setClearColor(0,0),gJ.setPixelRatio(Math.min(devicePixelRatio,2)),gJ.outputColorSpace=N8,gJ.toneMapping=_7,gJ.toneMappingExposure=1.2,gJ.shadowMap.enabled=!0,gJ.shadowMap.type=k7;let J=gJ.domElement;J.tabIndex=0,J.setAttribute("role","img"),H9.append(J);let Q=new kZ(X9,J),$=matchMedia("(max-width: 760px), (pointer: coarse)"),Z=()=>{Q.enabled=!$.matches,J.style.touchAction=$.matches?"auto":"none",J.classList.toggle("rotation-disabled",$.matches),RQ.querySelector("span").textContent=$.matches?"Tap an object.":"Drag to rotate. Tap an object.",J.setAttribute("aria-label",`Interactive Aero clay scene. ${$.matches?"Use arrow keys to rotate.":"Drag or use arrow keys to rotate."} Use the buttons below to animate objects.`)};Z(),$.addEventListener("change",Z),Q.target.set(-0.12,1.44,0),Q.enablePan=!1,Q.enableZoom=!1,Q.enableDamping=!1,Q.rotateSpeed=0.65,Q.minPolarAngle=0.35,Q.maxPolarAngle=Math.PI/2+0.12,Q.update(),q6.add(new QQ(15856895,7439537,2.2));let W=new V9(16775663,3.1);W.position.set(-3,7,4),W.castShadow=!0,W.shadow.mapSize.set(2048,2048),W.shadow.camera.left=-5,W.shadow.camera.right=5,W.shadow.camera.top=5,W.shadow.camera.bottom=-5,W.shadow.normalBias=0.025,W.shadow.bias=-0.0001,W.shadow.radius=4,q6.add(W);let H=new V9(12965887,1.4);H.position.set(4,3,-2),q6.add(H);let X=(await new CZ().loadAsync("/aero-scene.glb")).scene;q6.add(X);let K=[],U=[],G=[],q=[];X.traverse((g)=>{if(g.isMesh)g.castShadow=!0,g.receiveShadow=!0;if(g.userData.action==="coin")K.push(g);if(g.name.startsWith("Chart_column"))U.push(g);if(g.name.startsWith("Prompt_"))G.push(g);if(/^(Monitor_body|Rounded_display_plinth|Chart_column)/.test(g.name))q.push(g)});let E=mY(K,q);E.resolve();let O=K.map((g)=>({quaternion:g.quaternion.clone(),position:g.position.clone()})),D=U.map((g)=>({scale:g.scale.clone(),position:g.position.clone(),height:new wJ().setFromObject(g).getSize(new P).y})),k=document.createElement("canvas");k.width=528,k.height=408;let N=k.getContext("2d"),F=new i7(k);F.colorSpace=N8;let C=new IJ(new L9(1.64,1.4),new Z8({map:F}));C.position.set(-0.62,1.86,0.043),C.visible=!1,C.name="Aero_animation",q6.add(C);let L=new Map,_=0,j=!0,w=!1,S=()=>{E.resolve(),gJ.render(q6,X9)},p=(g)=>{if(_=0,!j||document.hidden)return;for(let[$0,w0]of L){let u0=Math.min(1,(g-w0.start)/w0.duration);if(w0.update(u0),u0===1)L.delete($0),w0.done?.()}if(S(),L.size)_=requestAnimationFrame(p)},z=()=>{if(!_&&j&&!document.hidden)_=requestAnimationFrame(p)},V=(g,$0,w0,u0)=>{L.set(g,{start:performance.now(),duration:wZ.matches?1:$0,update:w0,done:u0}),z()};function A(g=K){if(L.has("coins"))return;V("coins",1100,($0)=>{uY(K,O,g,$0,wZ.matches)},()=>{Y9.textContent="Coins flipped."})}function m(){if(L.has("chart"))return;w=!w;let g=U.map(($0)=>$0.scale.y);V("chart",850,($0)=>cY(U,D,g,w,$0),()=>{Y9.textContent=w?"Chart raised. Click again to lower it.":"Chart returned to its original height."})}let c=["#5b6b9c","#2f5ee6","#7fb2ff","#eef0f5","#ef4a2f","#b8352a"];function l(g,$0){N.fillStyle="#171824",N.fillRect(0,0,528,408);let w0=19,u0=48,s0=50;c.forEach((n,W0)=>{let Q0=1.4*Math.abs(W0-2.5)**1.5,M0=Q0+9+Q0*0.35,S0=g==="intro"?22*(1-OQ(Math.min(1,Math.max(0,$0-W0*3)/18))):0;for(let T0=0;T0<44;T0++){let GJ=T0/2;if(GJ+0.5<Math.max(Q0,S0)||GJ>M0)continue;let I=$0/30*34-6,ZJ=g==="intro"?GJ-S0:Math.abs(GJ-W0*0.8-I),x0=g==="intro"?Math.max(0,0.7-ZJ*0.2):g==="sweep"?Math.max(0,0.55*(1-ZJ/2.5)):0;N.fillStyle=new P0(n).lerp(new P0("white"),Math.min(0.8,x0)).getStyle(),N.fillRect(u0+GJ*w0,s0+W0*3*w0,w0/2+0.1,w0*2)}}),F.needsUpdate=!0}function i(){if(L.has("aero"))return;if(G.forEach((g)=>g.visible=!1),C.visible=!0,wZ.matches){l("idle",0),S(),Y9.textContent="Aero mark displayed with reduced motion.";return}V("aero",3600,(g)=>{let $0=g*3600;l($0<1440?"intro":$0<2100?"idle":"sweep",$0<1440?$0/40:($0-2100)/40)},()=>{l("idle",0),Y9.textContent="Aero animation played."})}function u(){L.clear(),w=!1,K.forEach((g,$0)=>{g.quaternion.copy(O[$0].quaternion),g.position.copy(O[$0].position)}),U.forEach((g,$0)=>{g.scale.copy(D[$0].scale),g.position.copy(D[$0].position)}),G.forEach((g)=>g.visible=!0),C.visible=!1,X9.position.copy(tq),Q.target.set(-0.12,1.44,0),Q.update(),S(),Y9.textContent="Scene reset."}document.querySelector('[data-scene="coins"]').addEventListener("click",()=>A()),document.querySelector('[data-scene="chart"]').addEventListener("click",m),document.querySelector('[data-scene="aero"]').addEventListener("click",i),document.querySelector('[data-scene="reset"]').addEventListener("click",u);let r=new YQ,b=null;J.addEventListener("pointerdown",(g)=>{b={x:g.clientX,y:g.clientY}}),J.addEventListener("pointercancel",()=>{b=null}),J.addEventListener("pointerup",(g)=>{if(!b||Math.hypot(g.clientX-b.x,g.clientY-b.y)>6){b=null;return}b=null;let $0=J.getBoundingClientRect();r.setFromCamera(new _0((g.clientX-$0.left)/$0.width*2-1,1-(g.clientY-$0.top)/$0.height*2),X9);let w0=r.intersectObjects([X,C],!0)[0];if(!w0)return;let u0=w0.object;while(u0){if(K.includes(u0)){A([u0]);return}if(U.includes(u0)){m();return}if(/Monitor|Recessed|Prompt|Aero_animation/.test(u0.name)){i();return}u0=u0.parent}}),J.addEventListener("keydown",(g)=>{if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home"].includes(g.key))return;if(g.preventDefault(),g.key==="Home"){u();return}let $0=new z9().setFromVector3(X9.position.clone().sub(Q.target));$0.theta+=g.key==="ArrowLeft"?0.15:g.key==="ArrowRight"?-0.15:0,$0.phi=cJ.clamp($0.phi+(g.key==="ArrowUp"?-0.1:g.key==="ArrowDown"?0.1:0),Q.minPolarAngle,Q.maxPolarAngle),X9.position.copy(new P().setFromSpherical($0).add(Q.target)),Q.update(),S()}),Q.addEventListener("change",S),new ResizeObserver(()=>{gJ.setSize(H9.clientWidth,H9.clientHeight,!1),S()}).observe(H9),new IntersectionObserver(([g])=>{if(j=g.isIntersecting,j)z()},{threshold:0}).observe(H9),document.addEventListener("visibilitychange",z),J.addEventListener("webglcontextlost",(g)=>{g.preventDefault(),L.clear(),H9.classList.remove("scene-ready"),RQ.hidden=!0,Y9.textContent="3D paused. Reload to restore it."}),RQ.hidden=!1,H9.classList.add("scene-ready"),S()}
