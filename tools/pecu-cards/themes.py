"""Thirty modeled miniature settings, following the approved numbered concepts."""
from clay import *


def sprig(x,z,height=1.1,y=.25):
    line('Plant stem',[(x,y,z),(x+.07,y,z+height)],.025,'sage')
    for i in range(3):
        leaf('Plant leaf',(x,y,z+.18+i*.23),.55,.16,(-1 if i%2 else 1)*.85)


def scatter_stars(mat='gold',y=.28):
    for x,z,r in [(-2.3,6.6,.2),(2.3,7.3,.2),(.9,7.9,.15),(-.7,7.6,.12)]:star('Small star',(x,y,z),r,mat)


def pebbles(mat='cream'):
    for i in range(9):
        x=-2.4+i*.60
        sphere('Rounded stone',(x,-.7,1.6),(.16+random.random()*.08,.23,.13),mat)


def forest(back='forest'):
    for x,h in [(-2.25,2.9),(-1.2,1.8),(1.3,2.4),(2.35,3.4)]:
        box('Tree trunk',(x,.39,5.2),(.16,.12,1.8),'wood',.05)
        for j in range(3):
            z=5+j*.57
            profile('Layered pine',[(0,h*.50),(-.64+j*.12,-.3),(.64-j*.12,-.3)],(x,.24-j*.05,z),.11,back,.08)


def satchel(pos,scale=.7,mat='wood'):
    x,y,z=pos
    box('Satchel body',pos,(.8*scale,.38*scale,.68*scale),mat,.12)
    box('Satchel flap',(x,y-.23*scale,z+.18*scale),(.85*scale,.12*scale,.36*scale),mat,.1)
    disk('Satchel clasp',(x,y-.31*scale,z+.03*scale),.07*scale,.04,'gold')


def envelope(pos,scale=.7):
    x,y,z=pos
    box('Envelope',pos,(.95*scale,.14,.67*scale),'ivory',.055)
    line('Envelope fold',[(x-.44*scale,y-.09,z+.26*scale),(x,y-.1,z-.07*scale),(x+.44*scale,y-.09,z+.26*scale)],.022,'cream')
    star('Envelope seal',(x,y-.14,z-.05*scale),.1,'coral',4)


def garden(root):
    for x,z,a in [(-.12,6.25,-.65),(.10,6.25,.65),(-.13,6.36,-2.3),(.14,6.36,2.3)]:
        leaf('Four leaf clover',(x,.22,z),1.35,.53,a)
    line('Clover stalk',[(0,.37,4.7),(.13,.30,5.5),(0,.22,6.38)],.055,'leaf')
    for x in [-2.55,2.43]:
        sprig(x,3.5,2.1)
        grass((x,-.1,1.55),.26,18)
    for x,z in [(-2.4,6.9),(2.35,5.8),(-1.9,1.7),(2.1,1.8)]:flower('Daisy',(x,-.12,z),.26)
    pebbles()
    pot('Seedling',(-1.72,-1.12,1.55),.55)
    for i in range(10):grass((-2.3+i*.5,-.17,1.52),.24,8)


def moon_keeper(root):
    root.location.z=2.1
    moon('Crescent cradle',(-.55,.28,4.45),2.58,'cream',.25)
    cloud('Lower cloud',(-1.75,-.26,1.85),.83,'lavender')
    cloud('Lower cloud',(1.55,-.22,1.8),.78,'lavender')
    cloud('Distant cloud',(1.7,.36,6.8),.69,'lavender')
    for x,z,r in [(-1.3,7.3,.25),(.25,7.0,.29),(1.2,7.7,.24),(2.3,5.8,.16)]:
        line('Star thread',[(x,.22,8.22),(x,.22,z+.15)],.011,'cream');star('Hanging star',(x,.12,z),r)
    scatter_stars('cream',.40)


def coral_tide(root):
    for side in [-1,1]:
        x=side*2.25
        for j in range(3):
            z=2.2+j*.9
            line('Coral branch',[(x,.17,1.55),(x-side*.10,.13,z),(x+side*.28,.09,z+.46)],.075,'coral')
            line('Coral branch fork',[(x,.13,z-.2),(x-side*.4,.11,z+.16),(x-side*.46,.1,z+.56)],.058,'blush')
        sprig(side*1.8,5.4,1.5)
    for z in [6.7,7.1,7.55]:
        line('Ocean wave',[(-2.5,.36,z),(-1.5,.30,z+.16),(-.2,.31,z-.14),(1.1,.31,z+.16),(2.4,.33,z)],.06,'mint')
    for x,z,r in [(1.5,6.0,.21),(1.3,6.6,.12),(.85,7.6,.13),(-2.4,5.6,.11)]:sphere('Pearl bubble',(x,.02,z),(r,.08,r),'ivory')
    pebbles('ice')
    for i in range(7):
        a=-1.05+i*.35
        o=sphere('Shell scallop',(-1.85+math.sin(a)*.27,-1.07,1.75+math.cos(a)*.28),(.09,.13,.34),'blush');o.rotation_euler.y=a
    sphere('Pearl',(-1.85,-1.25,1.88),(.19,)*3,'ivory')
    star('Starfish',(2,-.94,1.71),.31,'coral')


def cloud_courier(root):
    root.location.z=2.1
    for x,z,sz in [(-2.2,2.0,1),(2.0,1.8,1),(-1.8,6.7,.83),(1.8,7.5,.75),(.5,6.5,.52)]:cloud('Puffed cloud',(x,.0,z),sz)
    satchel((1,-.8,2.6),.7)
    line('Satchel strap',[(.45,-.72,3.1),(1,-.85,2.8),(1.5,-.57,2.6)],.055,'wood')
    envelope((-1.4,-1.02,3.65),.85)
    scatter_stars('yellow')


def mushroom_cottage(root):
    root.scale=(.91,)*3;root.location=(-.75,-.27,1.67)
    box('Cottage stem',(1.25,.27,5.1),(2.1,.56,3.6),'cream',.5)
    sphere('Mushroom roof',(1.1,.01,7.15),(1.77,.73,.78),'coral')
    for x,z in [(.1,7.25),(.7,7.7),(1.55,7.3),(2.15,7.03)]:sphere('Roof spot',(x,-.66,z),(.23,.035,.13),'ivory')
    box('Cottage door',(1.23,-.06,4.16),(1.12,.14,1.62),'wood',.4)
    for x in [.85,1.1,1.35,1.6]:line('Door planks',[(x,-.16,3.53),(x,-.17,4.75)],.012,'sand')
    sphere('Door knob',(1.56,-.22,4.1),(.07,)*3,'gold')
    disk('Round window',(1.2,-.09,6.06),.43,.09,'lamp')
    ring('Window surround',(1.2,-.16,6.06),.44,.065,'wood')
    box('Window mullion',(1.2,-.21,6.06),(.07,.07,.82),'wood',.015)
    box('Window mullion',(1.2,-.21,6.06),(.82,.07,.07),'wood',.015)
    for x,z,sz in [(-2.2,1.55,.95),(2.25,1.57,.8),(-2.45,4.9,.65)]:mushroom('Garden mushroom',(x,-.3,z),sz)
    sprig(-2.6,5.8,1.7)
    for x in [-2.5,-1.9,1.8,2.4]:grass((x,-.45,1.52),.3,12)
    pebbles()


def arcade(root):
    for i in range(8):
        for j in range(3):box('Checker floor',(-2.43+i*.68,-.69+j*.42,1.53),(.67,.41,.055),'cream' if (i+j)%2 else 'plum',.012)
    box('Arcade upper canopy',(0,.15,7.82),(5.2,.53,.54),'lilac',.18)
    sphere('Arcade lamp',(0,-.10,7.53),(.42,.27,.14),'lamp')
    for x in [-2.3,2.3]:
        box('Speaker cabinet',(x,.18,5.75),(.73,.36,1.65),'lilac',.16)
        for z in [5.32,5.73,6.14]:disk('Speaker hole',(x,-.035,z),.13,.04,'plum')
    for x in [-.95,-.65,-.35,.35,.65,.95]:
        for z in [6.25,6.55]:box('Arcade pixel',(x,.20,z),(.23,.13,.23),'cream',.025)
    star('Arcade icon',(1.4,.12,6.7),.32,'coral')
    box('Control panel',(0,-1.02,1.8),(5.1,.77,.36),'lilac',.16)
    disk('Joystick base',(-1.8,-1.1,2.02),.25,.08,'dark',False)
    line('Joystick shaft',[(-1.8,-1.1,2.04),(-1.8,-1.1,2.5)],.065,'dark')
    sphere('Joystick ball',(-1.8,-1.1,2.54),(.21,)*3,'coral')
    for x,y,m in [(1.25,-1.2,'coral'),(1.85,-1.0,'mint'),(.66,-1.03,'cream')]:disk('Arcade button',(x,y,2.02),.23,.12,m,False)


def baker(root):
    for x in [-2.6,-2.1,-1.6,-1.1,-.6,-.1,.4,.9,1.4,1.9,2.4]:sphere('Scalloped icing',(x,.09,8.07),(.29,.18,.25),'ivory')
    for z in [5.8,7.2]:
        box('Bakery shelf',(0,.25,z),(4.7,.5,.13),'sand',.055)
        for i,x in enumerate([-1.8,-.7,.6,1.7]):
            box('Ingredient jar',(x,.22,z+.45),(.55,.4,.65),'cream',.18)
            disk('Jar cap',(x,.22,z+.83),.29,.10,'pink' if i%2 else 'coral',False)
    for x,z in [(-1.30,5.85),(-.93,5.93),(-.58,5.83)]:sphere('Chef hat puff',(x,-.36,z),(.32,.3,.34),'ivory')
    box('Chef hat band',(-.94,-.38,5.58),(.99,.56,.27),'cream',.09)
    for x in [-2.1,-1.55,1.7,2.35]:
        star('Star cookie',(x,-1.13,1.77),.25,'sand')
        star('Cookie icing',(x,-1.22,1.8),.19,'ivory')
    roll=disk('Rolling pin',(0,-1.0,1.79),.15,1.45,'sand',False);roll.rotation_euler.y=math.pi/2
    line('Rolling pin handles',[(-1,-1,1.8),(1,-1,1.8)],.064,'coral')
    flower('Icing flower',(2.45,.1,7.7),.28,'pink')


def vinyl(root):
    moon('Crescent lamp',(-2,.14,6.52),.67,'lamp')
    disk('Night window',(1.35,.43,6.6),1.22,.10,'indigo')
    ring('Night window rim',(1.35,.35,6.6),1.23,.085,'wood')
    moon('Window moon',(1.56,.25,6.85),.44,'cream')
    scatter_stars('cream')
    line('Headphone band',[(-2.4,-.34,4.2),(-2.2,-.23,5.25),(-.93,-.17,5.85),(.4,-.23,5.25),(.63,-.35,4.2)],.14,'cream')
    for x in [-2.4,.63]:
        sphere('Ear pad',(x,-.43,4.35),(.22,.25,.39),'wood')
        sphere('Ear cup',(x,-.62,4.35),(.21,.17,.35),'cream')
    box('Record player',(-1.58,-.87,1.94),(1.73,1.0,.35),'wood',.12)
    disk('Vinyl record',(-1.64,-.87,2.16),.56,.035,'dark',False)
    for r in [.2,.32,.43,.52]:ring('Vinyl groove',(-1.64,-.87,2.184),r,.008,'plum',False)
    disk('Record label',(-1.64,-.87,2.19),.17,.015,'coral',False)
    line('Tone arm',[(-.95,-.61,2.20),(-.91,-.91,2.25),(-1.25,-1.1,2.24)],.044,'cream')
    for i,m in enumerate(['lilac','cream','coral']):book('Vinyl sleeve',(1.83+i*.27,.08-i*.10,4.9),(.42,.25,1.0),m,-.13)


def treasure(root):
    coral_tide(root)
    for x,z in [(-2.6,2.6),(-2.6,4.7),(-2.6,6.8),(2.6,2.6),(2.6,4.7),(2.6,6.8)]:disk('Porthole bolt',(x,-.03,z),.12,.07,'gold')
    ring('Diving helmet rim',(1.61,-.76,3.05),.72,.115,'gold')
    for a in [0,1.57,3.14,4.71]:sphere('Helmet bolt',(1.61+.71*math.cos(a),-.9,3.05+.71*math.sin(a)),(.065,)*3,'cream')
    box('Treasure chest',(1.5,-.96,1.98),(1.27,.74,.65),'wood',.12)
    lid=box('Open chest lid',(1.5,-.49,2.51),(1.3,.14,.73),'wood',.12);lid.rotation_euler.x=-.35
    for x in [1.03,1.98]:box('Chest strap',(x,-1.355,1.98),(.09,.04,.56),'gold',.01)
    for i in range(7):coin('Treasure coin',(1.14+random.random()*.75,-1.1+random.random()*.3,2.36+random.random()*.14),.14)


def explorer(root):
    for x,z,h in [(-1.9,5.3,2.1),(-.3,5.9,1.9),(1.4,5.5,2.4)]:
        profile('Mountain',[(-.9,-.5),(0,h),(.95,-.5)],(x,.30,z),.20,'sand',.15)
        profile('Snow cap',[(-.32,h*.54),(0,h),(.3,h*.55),(.09,h*.62),(-.1,h*.53)],(x,.15,z),.10,'cream',.04)
    sphere('Explorer hat brim',(-.94,-.25,5.57),(1.03,.56,.12),'sand')
    sphere('Explorer hat dome',(-.94,-.22,5.8),(.66,.47,.48),'cream')
    line('Hat band',[(-1.52,-.5,5.67),(-.94,-.68,5.67),(-.39,-.5,5.67)],.07,'wood')
    satchel((-1.65,-.71,2.1),.75)
    profile('Paper boat hull',[(-.72,.24),(.72,.24),(.4,-.25),(-.32,-.25)],(-.65,-1.04,1.97),.45,'ivory',.04)
    profile('Paper sail',[(-.42,0),(.04,.81),(.48,0)],(-.6,-1.05,2.18),.055,'cream',.01)
    disk('Compass',(1.87,-1.06,1.95),.38,.09,'gold')
    disk('Compass face',(1.87,-1.12,1.95),.3,.02,'cream')
    profile('Compass needle',[(0,.23),(.07,0),(0,-.21),(-.07,0)],(1.87,-1.15,1.95),.025,'coral',.01)
    for zz in [2.1,3,4,5,6,7]:box('Journal layered edge',(3.11,.94,zz),(.10,.4,.06),'cream',.02)


def picnic(root):
    for i in range(11):
        for j in range(5):box('Gingham square',(-2.5+i*.49,-.95+j*.34,1.54),(.48,.33,.025),'ivory' if (i+j)%2 else 'pink',.005)
    for x,z in [(-.75,6.45),(.88,6.3)]:
        sphere('Oversized cherry',(x,.12,z),(.76,.38,.72),'red')
        line('Cherry stem',[(x,.17,z+.6),(x*.6,.19,7.4),(.25,.22,7.91)],.065,'sage')
    leaf('Cherry leaf',(.25,.10,7.88),1.42,.46,1.95)
    box('Wicker basket',(2.05,-.3,2.25),(1.1,.7,.97),'sand',.17)
    for z in [1.92,2.1,2.28,2.46,2.64]:line('Wicker row',[(1.53,-.69,z),(2.06,-.74,z),(2.56,-.68,z)],.035,'cream')
    for x in [1.65,1.85,2.05,2.25,2.45]:line('Wicker rib',[(x,-.7,1.86),(x,-.75,2.3),(x,-.7,2.7)],.03,'ochre')
    line('Basket handle',[(1.58,-.2,2.68),(1.7,-.2,3.12),(2.08,-.2,3.28),(2.53,-.2,2.68)],.07,'sand')
    for x,z in [(-2.4,2.1),(-2.4,5.8),(2.4,5.6)]:flower('Picnic daisy',(x,.03,z),.3)


def greenhouse(root):
    for r,mat in [(2.43,'blush'),(2.20,'yellow'),(1.98,'mint'),(1.76,'sky')]:
        pts=[(r*math.cos(a),.38,5.88+r*math.sin(a)) for a in [i*math.pi/24 for i in range(25)]]
        line('Pastel rainbow',pts,.10,mat)
    line('Greenhouse arch',[(-2.6,.15,2.0),(-2.6,.15,6.0),(-1.85,.15,7.6),(0,.15,8.16),(1.85,.15,7.6),(2.6,.15,6.0),(2.6,.15,2.0)],.11,'cream')
    for x in [-1.35,0,1.35]:line('Greenhouse mullion',[(x,.2,5.7),(x,.2,7.7 if x else 8.1)],.055,'cream')
    for x in [-2.25,2.25]:pot('Greenhouse plant',(x,-.18,1.55),.95)
    pot('Front seedling',(-1.4,-1.08,1.55),.50)
    flower('Flower lamp',(0,-.08,7.43),.43,'ivory')
    sphere('Flower lamp light',(0,-.11,7.16),(.15,)*3,'lamp')
    pebbles()


def cloud_nine(root):
    root.location.z=2.08
    for n in ['Eye · Near','Eye · Far']:bpy.data.objects[n].scale.z*=.14
    for x,z,sz in [(-1.8,1.87,1.15),(-.6,1.64,1.2),(.65,1.73,1.15),(1.9,1.86,.8),(-1.7,6.52,.75),(1.85,6.17,.68)]:cloud('Pillow cloud',(x,-.3,z),sz,'ivory')
    moon('Sleep moon',(1.23,.22,7.06),.88,'cream')
    for x,z in [(-1.28,7.35),(.02,7.03),(-.32,7.91)]:
        line('Mobile string',[(x,.08,8.13),(x,.08,z)],.012,'cream');star('Mobile star',(x,-.06,z),.26,'yellow')
    for x in [-2.88,2.88]:sphere('Pillow corner',(x,.15,8.4),(.36,.30,.35),'blush')


def matcha(root):
    disk('Garden round relief',(1.38,.4,6.2),1.8,.1,'sage')
    for x in [-2.2,2.35]:
        line('Bamboo cane',[(x,.16,3.9),(x,.16,7.5)],.07,'leaf')
        for z in [4.4,5.25,6.1,6.95]:box('Bamboo joint',(x,.04,z),(.21,.06,.085),'sage',.02)
        for z in [5.6,6.8]:leaf('Bamboo leaf',(x,.12,z),.74,.15,-.7 if x>0 else .7)
    for j in range(6):
        line('Raked sand groove',[(-2.6+i*.27,-1.01+j*.24+.09*math.sin(i*.5),1.533) for i in range(20)],.012,'cream')
    cup('Matcha',(1.8,-1.12,1.64),1.08,'sage')
    for i in range(9):
        a=TAU*i/9
        line('Whisk bamboo tine',[(2.58,-.65,1.65),(2.58+.2*math.cos(a),-.65+.2*math.sin(a),2.23),(2.58+.12*math.cos(a),-.65+.12*math.sin(a),2.52)],.016,'cream')
    disk('Whisk foot',(2.58,-.65,1.71),.11,.25,'sand',False)
    pebbles('sage')


def sailor(root):
    root.location.z=2.5;root.scale=(1.0,)*3
    disk('Setting sun',(.7,.42,6.6),1.42,.16,'yellow')
    for j in range(3):
        line('Ocean swell',[(-2.55,.3,5.45+j*.24),(-1.2,.25,5.55+j*.24),(.5,.25,5.40+j*.24),(2.5,.30,5.5+j*.24)],.055,'ochre')
    moon('Golden crescent boat',(-.10,-.49,3.78),2.34,'gold',math.pi/2)
    line('Mast',[(-2.20,.01,2.55),(-2.20,.01,7.4)],.06,'wood')
    profile('Sail',[(-.02,0),(1.32,-1.98),(-.02,-1.98)],(-2.15,-.03,7.15),.10,'ivory',.04)
    for j in range(3):
        line('Sculpted foreground wave',[(-2.6,-.90,1.7+j*.21),(-1.4,-.97,1.95+j*.21),(-.15,-.99,1.68+j*.21),(1.4,-.99,1.87+j*.21),(2.6,-.90,1.69+j*.21)],.11,'terracotta' if j%2 else 'ochre')
    sphere('Captain hat',( -.88,-.27,6.28),(.65,.38,.19),'ivory')
    box('Captain hat band',(-.88,-.3,6.14),(1.13,.43,.12),'indigo',.04)
    star('Captain insignia',(-.88,-.69,6.25),.12)


def frost(root):
    for x in [-2.2,-1.4,1.5,2.45]:crystal('Ice crystal',(x,.06,1.52),random.uniform(.8,1.7),'ice',.22)
    for x,z in [(-2.3,6.7),(-1.4,7.7),(.2,7.4),(1.55,6.55),(2.45,7.6)]:
        for a in [0,math.pi/3,2*math.pi/3]:line('Snowflake',[(x-.19*math.cos(a),.09,z-.19*math.sin(a)),(x+.19*math.cos(a),.09,z+.19*math.sin(a))],.023,'snow')
    for x in [-2.1,0,2.0]:cloud('Snow drift',(x,-.20,1.57),.8,'snow')
    line('Scarf collar',[(-.23,-.93,2.45),(.25,-1.00,2.39),(1.02,-.98,2.42)],.17,'ice')
    for i in range(11):
        z=2.42-i*.075
        for j in range(4):
            x=.28+j*.065
            line('Knitted scarf stitch',[(x-.025,-1.13,z+.022),(x,-1.155,z),(x+.025,-1.13,z+.023)],.025,'snow' if i%4==0 else 'ice')
    for x in [.27,.36,.45,.54]:line('Scarf fringe',[(x,-1.13,1.68),(x+.03,-1.13,1.51)],.025,'ice')
    for x in [-1.6,-1.2,-.8,-.4]:sphere('Snow on shell',(x,-.05,5.59-abs(x+.95)*.21),(.26,.17,.12),'snow')


def bloom(root):
    flower('Giant flower canopy',(0,.24,7.18),1.83,'pink','yellow',8)
    for i in range(7):
        a=TAU*i/7
        o=sphere('Petal nest',(math.sin(a)*1.98,-.10+math.cos(a)*.35,1.78),(.60,.33,.16),'blush');o.rotation_euler.z=-a
    for side in [-1,1]:
        x=side*2.7
        line('Climbing vine',[(x,.14,1.7),(x-side*.16,.13,3.7),(x+side*.10,.15,5.7),(x-side*.35,.13,7.75)],.065,'sage')
        for z in [2.6,4,5.5,7.2]:leaf('Vine leaf',(x,.05,z),.61,.18,-side*.65)
        flower('Small vine blossom',(x,-.08,4.75),.3,'pink')
    grass((-2,-.7,1.56),.3,12);grass((2,-.7,1.56),.3,12)


def lucky(root):
    for x in [-2.55,2.55]:
        box('Claw cabinet side',(x,.12,5.0),(.28,.5,5.4),'blush',.10)
        for z in [3.2,4.2,5.2,6.2,7.2]:sphere('Cabinet light',(x,-.16,z),(.095,.08,.095),'lamp')
    line('Claw cable',[(0,.06,8.02),(0,.06,7.5)],.10,'dark')
    sphere('Claw hub',(0,.0,7.34),(.49,.25,.38),'blush')
    star('Claw emblem',(0,-.29,7.34),.21,'cream')
    for side in [-1,1]:
        line('Claw finger',[(side*.26,.02,7.14),(side*.68,-.02,6.70),(side*.61,-.05,6.16)],.12,'cream')
        sphere('Claw pad',(side*.59,-.04,6.18),(.18,.16,.27),'pink')
    for x,z in [(-2.18,2.4),(2.18,2.2),(-2.15,4.6),(1.95,4.7),(.15,5.95)]:
        star('Plush star prize',(x,.10,z),.48,'yellow' if x<0 else 'blush')
        for dx in [-.1,.1]:sphere('Plush eye',(x+dx,-.04,z+.02),(.024,.018,.03),'brown')
    for x in [-2.3,-1.6,-.9,.2,1.1,2]:star('Prize pile',(x,-.67,1.72),.32,'yellow' if x<0 else 'blush')


def museum(root):
    root.location.z=2.10
    for x in [-2.36,2.36]:
        box('Gallery column',(x,.04,4.64),(.34,.35,5.25),'ivory',.15)
        box('Column capital',(x,-.03,7.10),(.69,.53,.30),'cream',.08)
    line('Gallery arch',[(-2.35,.04,7.12),(-1.7,.04,7.82),(0,.04,8.12),(1.7,.04,7.82),(2.35,.04,7.12)],.18,'ivory')
    disk('Sun relief',(0,.28,6.43),.83,.10,'gold')
    for i in range(16):
        a=TAU*i/16
        profile('Sun ray',[(0,.22),(.075,0),(-.075,0)],(1.14*math.cos(a),.26,6.43+1.14*math.sin(a)),.08,'gold',.02).rotation_euler.y=0
        line('Sunray line',[(.9*math.cos(a),.22,6.43+.9*math.sin(a)),(1.32*math.cos(a),.22,6.43+1.32*math.sin(a))],.035,'gold')
    box('Pedestal plinth',(0,-.2,1.86),(4.96,1.53,.40),'ivory',.15)
    box('Pedestal step',(0,-.2,1.57),(5.24,1.6,.18),'cream',.08)
    for x in [-2.45,2.45]:
        line('Rope post',[(x,-.88,1.55),(x,-.88,2.67)],.043,'gold')
        sphere('Post finial',(x,-.88,2.71),(.10,)*3,'gold')
    for side in [-1,1]:line('Velvet rope',[(side*2.45,-.88,2.6),(side*2.18,-.45,2.22),(side*2.50,.2,2.5)],.043,'burgundy')


def campfire(root):
    root.scale=(.94,)*3;root.location.x=-.53
    forest()
    moon('Night moon',(1.6,.15,7.3),.65,'cream')
    scatter_stars('cream')
    sphere('Knitted cap',(-1.1,-.24,5.28),(.68,.39,.46),'sage')
    line('Hat brim',[(-1.75,-.47,5.12),(-1.1,-.67,5.04),(-.46,-.47,5.12)],.1,'cream')
    for i in range(11):
        x=-1.64+i*.11
        line('Hat knitted rib',[(x,-.48,5.16),(-1.1+(x+1.1)*.6,-.58,5.46),(-1.1+(x+1.1)*.12,-.35,5.69)],.02,'mint')
    sphere('Hat pompom',(-1.1,-.24,5.75),(.20,)*3,'cream')
    for i in range(7):
        a=TAU*i/7;sphere('Fire stone',(1.8+.47*math.cos(a),-.7+.3*math.sin(a),1.65),(.17,.15,.12),'sand')
    for ang in [-.7,.7]:
        o=box('Fire log',(1.8,-.7,1.81),(1.0,.19,.17),'wood',.07);o.rotation_euler.z=ang
    for x,h,mat in [(1.59,.75,'coral'),(1.84,1.1,'ochre'),(2.01,.58,'yellow')]:
        profile('Clay flame',[(-.17,0),(-.25,h*.35),(.02,h),(.1,h*.6),(.26,h*.22),(.17,0)],(x,-.77,1.89),.13,mat,.08)
    line('Toasting stick',[(.83,-.75,2.5),(1.68,-.81,3.15)],.023,'wood')
    marsh=sphere('Marshmallow',(1.72,-.82,3.19),(.17,.14,.21),'cream');marsh.rotation_euler.y=.4
    satchel((-2.03,-.7,1.97),.63,'sage')


def bubble_bath(root):
    root.location.z=2.12
    sphere('Clawfoot bath',(0,-.16,2.06),(2.43,.79,.72),'ivory')
    rim=ring('Bath rolled lip',(0,-.16,2.61),1,.10,'cream',False);rim.scale=(2.32,.72,1)
    water=disk('Bath water',(0,-.16,2.59),1,.045,'ice',False);water.scale=(2.21,.64,1)
    for x in [-1.65,1.65]:sphere('Bath foot',(x,-.38,1.57),(.22,.23,.27),'gold')
    for i in range(22):
        x=random.uniform(-2.1,2.1);r=random.uniform(.09,.2)
        sphere('Foam',(x,-.66,2.53+random.uniform(-.08,.15)),(r,)*3,'snow')
    for x,z,r in [(-2,6.7,.4),(-.5,7.3,.24),(1.0,6.4,.35),(2.1,7.4,.48)]:
        sphere('Soap bubble',(x,.12,z),(r,.15,r),'ice');sphere('Bubble glint',(x-r*.3,-.035,z+r*.3),(r*.18,.025,r*.25),'snow')
    sphere('Rubber duck',(1.75,-.94,2.54),(.31,.22,.22),'yellow')
    sphere('Duck head',(1.95,-.96,2.82),(.19,)*3,'yellow')
    sphere('Duck beak',(2.13,-1.02,2.78),(.14,.08,.055),'coral')
    sphere('Duck eye',(2,-1.13,2.86),(.028,)*3,'dark')
    box('Soap bar',(-1.9,-.95,1.82),(.59,.28,.19),'pink',.08)


def time_gardener(root):
    root.scale=(.93,)*3;root.location.x=-.55
    x=1.48
    for z in [4.5,7.7]:disk('Hourglass end',(x,.07,z),.81,.18,'wood',False)
    for xx in [x-.68,x+.68]:line('Hourglass support',[(xx,.07,4.6),(xx,.07,7.6)],.075,'gold')
    for side in [-1,1]:
        line('Hourglass glass outline',[(x+side*.57,-.02,7.5),(x+side*.48,-.02,6.85),(x+side*.12,-.02,6.1),(x+side*.48,-.02,5.35),(x+side*.57,-.02,4.7)],.047,'ice')
    profile('Upper sand',[(-.42,.38),(.42,.38),(0,-.37)],(x,-.02,6.72),.38,'sand',.03)
    profile('Lower sand',[(-.53,0),(0,.5),(.53,0)],(x,-.02,4.68),.4,'sand',.03)
    line('Falling sand',[(x,-.06,6.34),(x,-.06,5.2)],.021,'ochre')
    sprig(-2,5.65,1.95);sprig(2.45,3.45,2.1)
    sphere('Gardener hat brim',(-1.18,-.2,5.12),(.84,.52,.12),'sage')
    sphere('Gardener hat crown',(-1.18,-.18,5.31),(.5,.35,.37),'sage')
    sphere('Watering can',(-1.85,-1.0,1.97),(.42,.29,.4),'mint')
    ring('Watering handle',(-2.17,-.97,2.1),.30,.05,'mint')
    line('Watering spout',[(-1.55,-1,1.95),(-1.12,-1,2.38)],.075,'mint')
    pot('Time seedling',(2.17,-.9,1.59),.6)
    disk('Clay clock',(-.95,.24,7.15),.6,.12,'cream');ring('Clock rim',(-.95,.14,7.15),.6,.045,'gold')
    line('Clock hands',[(-.95,.04,7.56),(-.95,.04,7.15),(-.65,.04,7.15)],.035,'wood')


def postage(root):
    for x in [-3.15,3.15]:
        for i in range(17):sphere('Stamp scallop',(x,.9,.6+i*.48),(.21,.28,.21),'ivory')
    for z in [.25,8.75]:
        for i in range(12):sphere('Stamp scallop',(-2.65+i*.48,.9,z),(.21,.28,.21),'ivory')
    for x,z,r,mat in [(-1.4,5.8,1.45,'lavender'),(1.55,5.8,1.75,'lilac')]:
        sphere('Rolling postal hill',(x,.45,z),(r,.12,.72),mat)
    disk('Postal sun',(.7,.33,7.2),.57,.09,'yellow')
    for z in [6.7,7.0,7.3]:line('Postal cancellation wave',[(-2.15,.08,z),(-1.5,.08,z+.12),(-.9,.08,z-.08),(-.3,.08,z+.12)],.03,'cream')
    satchel((.05,-.82,2.3),.87,'wood');envelope((.02,-1.09,2.56),.57)
    envelope((2.1,-.8,1.86),.85)
    flower('Postal flower',(-2.2,-.8,1.85),.29,'yellow')


def cosmic(root):
    root.scale=(.8,)*3;root.location=(-.1,-.25,2.65)
    sphere('Moss planet',(0,-.1,2.46),(2.21,.76,.77),'sage')
    for i in range(12):grass((-1.9+i*.35,-.55,2.73),.18,5)
    ring('Terrarium rim',(0,.14,4.96),2.62,.11,'gold')
    line('Glass highlight',[(-2.24,-.03,5.15),(-1.99,-.03,6.24),(-1.25,-.03,7.12)],.048,'ice')
    for x,z,r in [(1.7,6.25,.36),(-1.15,6.75,.23),(1,7.46,.18)]:
        sphere('Orbit moon',(x,.05,z),(r,)*3,'lavender')
        orb=ring('Moon orbit',(x,-.03,z),r*1.4,.025,'gold');orb.rotation_euler.y=.4
    scatter_stars('cream');mushroom('Planet mushroom',(1.57,-.6,2.73),.6,'lilac')
    for x in [-2.03,2.1]:crystal('Planet crystal',(x,-.7,2.25),.6,'pink',.13)


def sculptor(root):
    box('Studio shelf',(0,.2,6.61),(4.7,.5,.15),'wood',.04)
    for i,mat in enumerate(['pink','yellow','mint','lilac','coral','sky']):
        sphere('Clay pigment jar',(-2+i*.8,.13,7.03),(.24,.2,.32),mat)
        disk('Jar lid',(-2+i*.8,.13,7.32),.23,.08,'cream',False)
    box('Miniature worktable',(0,-1.05,1.93),(3.5,.78,.17),'wood',.06)
    sphere('Mini Pecu body',(-.65,-1.13,2.18),(.59,.17,.13),'yellow')
    ring('Mini Pecu shell',(-.81,-1.13,2.52),.27,.11,'coral')
    coin('Mini coin',(-.81,-1.27,2.52),.15)
    for x in [-.22,-.07]:
        line('Mini eyestalk',[(x,-1.13,2.25),(x+.04,-1.13,2.48)],.035,'yellow')
        sphere('Mini eye',(x+.04,-1.16,2.48),(.025,)*3,'dark')
    sphere('Paint palette',(1,-1.1,2.08),(.57,.28,.07),'cream')
    for i,mat in enumerate(['pink','sky','leaf','coral']):sphere('Paint dab',(.72+i*.18,-1.2,2.14),(.06,.075,.027),mat)
    for x in [-2.16,2.25]:
        cup('Brush pot',(x,-.65,1.55),.65)
        for j in range(3):
            line('Brush handle',[(x+j*.09-.09,-.65,1.9),(x+j*.17-.17,-.65,2.72+j*.09)],.025,'wood')
            sphere('Brush tip',(x+j*.17-.17,-.65,2.78+j*.09),(.045,.04,.12),'pink' if j%2 else 'lilac')
    flower('Studio mark',(0,.18,7.85),.31,'pink')


def sunflower(root):
    root.location.z=2.1;root.scale=(.96,)*3
    for n in ['Eye · Near','Eye · Far']:bpy.data.objects[n].scale.z*=.14
    for i in range(15):
        a=TAU*i/15
        o=sphere('Sunflower petal',(2.05*math.sin(a),.02,3.29+1.65*math.cos(a)),(.42,.24,.88),'yellow');o.rotation_euler.y=a
    sphere('Sunflower seed bed',(0,-.2,1.95),(2.02,.69,.44),'ochre')
    for i in range(29):
        x=random.uniform(-1.8,1.8);sphere('Sunflower seed',(x,-.77,1.94+random.random()*.18),(.075,.03,.10),'brown')
    leaf('Big sunflower leaf',(-1.8,.25,4.9),1.65,.6,-.2)
    leaf('Big sunflower leaf',(1.7,.25,5.0),1.65,.6,.2)
    flower('High sunflower',(0,.25,7.25),.78,'yellow','brown',12)


def rainy(root):
    box('Window recess',(0,.46,5.69),(5.01,.2,4.62),'sky',.18)
    for x in [-2.42,0,2.42]:box('Window mullion',(x,.16,5.78),(.14,.16,4.57),'cream',.04)
    box('Window crossbar',(0,.11,6.25),(4.9,.17,.14),'cream',.04)
    for x in [-2.58,2.58]:
        for i in range(4):sphere('Curtain fold',(x+(i-1.5)*.15,-.06,5.44),(.15,.18,2.5),'coral')
    for x,z in [(-1.8,6.9),(-1.1,7.5),(.7,7.15),(1.7,6.7),(.6,5.7),(-1.6,5.9),(1.5,7.7)]:
        profile('Raindrop',[(0,.2),(-.09,-.05),(-.04,-.13),(.07,-.11),(.1,-.03)],(x,-.03,z),.06,'ice',.03)
    cloud('Rain cloud',(.8,.26,7.55),.6,'ice')
    cup('Rainy day cocoa',(1.8,-1.02,1.63),1.15)
    for i in range(3):box('Folded blanket',(-1.8,-.91,1.65+i*.10),(1.0,.62,.14),'lilac' if i%2 else 'lavender',.05)


def library(root):
    for z in [5.8,7.33]:
        box('Library shelf',(0,.1,z),(5.1,.66,.17),'sand',.04)
        for i in range(10):
            h=random.uniform(.83,1.24);book('Library volume',(-2.25+i*.49,.17,z+.12+h/2),(.35,.42,h),['burgundy','sage','indigo','sand','terracotta'][i%5],random.uniform(-.08,.08))
    mushroom('Reading lamp',(2.05,-.22,2.98),.89,'lamp')
    book('Closed folio',(-1.55,-.93,1.78),(1.47,.53,.35),'burgundy')
    for side in [-1,1]:
        profile('Open book pages',[(0,0),(side*.82,.13),(side*.82,.31),(0,.14)],(.38,-1.12,1.73),.64,'cream',.025)
        for j in range(4):line('Page writing',[(.38+side*.12,-1.46,1.88+j*.015),(.38+side*.67,-1.46,1.96+j*.015)],.006,'sand')
    line('Book ribbon',[(.4,-1.46,1.88),(.46,-1.46,1.57),(.7,-1.4,1.6)],.035,'coral')


def orchard(root):
    line('Orchard trunk',[(1.74,.28,2),(1.63,.26,5.0),(1.37,.22,6.76)],.17,'wood')
    for x,z in [(.45,6.3),(2.22,6.4),(1.3,7.23)]:
        line('Orchard branch',[(1.65,.25,5),(x,.24,z)],.075,'wood')
        sphere('Cloudlike orchard foliage',(x,.29,z),(.77,.2,.6),'lavender')
        line('Coin fruit stem',[(x,.07,z),(x,.07,z-.64)],.028,'sage');coin('Coin fruit',(x,-.03,z-.67),.27)
    for x in [-2.3,-1.75,1.92,2.42]:
        for j in range(3):crystal('Orchard crystal',(x+j*.12,-.9+j*.09,1.5),.45+j*.25,'pink' if j%2 else 'lilac',.15)
    for i in range(13):sphere('Soil pebble',(-2.4+i*.39,-.94,1.23),(.075,.04,.043),'sand')
    sprig(-2.33,5.5,1.8);pebbles('lavender')


def connection(root):
    for x,mat in [(-.51,'cream'),(.51,'gold')]:ring('Connection link',(x,.07,6.8),.93,.21,mat)
    for x,z,r in [(-2.25,6.5,.23),(2.23,6.7,.26),(-1.35,7.87,.16),(1.6,7.83,.19)]:star('Connection sparkle',(x,.03,z),r,'ivory',4)
    disk('X charm',(-1.73,-1.15,1.94),.42,.13,'cream')
    for sign in [-1,1]:line('X mark',[(-1.91,-1.25,1.94-sign*.21),(-1.55,-1.25,1.94+sign*.21)],.045,'brown')
    ring('Charm hanger',(-1.73,-1.14,2.43),.12,.035,'gold')
    for i in range(7):coin('Welcome coin',(.3+i*.31,-.94,1.65+random.uniform(0,.14)),.14)
    for i in range(8):
        x=random.uniform(-2.3,2.3);z=random.uniform(5.8,7.9)
        o=box('Clay confetti',(x,.11,z),(.10,.07,.23),['pink','mint','lilac'][i%3],.04);o.rotation_euler.y=random.uniform(-1,1)


BUILDERS=[garden,moon_keeper,coral_tide,cloud_courier,mushroom_cottage,arcade,baker,vinyl,treasure,explorer,
    picnic,greenhouse,cloud_nine,matcha,sailor,frost,bloom,lucky,museum,campfire,bubble_bath,time_gardener,
    postage,cosmic,sculptor,sunflower,rainy,library,orchard,connection]
