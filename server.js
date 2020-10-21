const express = require('express')
const Handlebars = require('handlebars')
const expressHandlebars = require('express-handlebars')
const {allowInsecurePrototypeAccess} = require('@handlebars/allow-prototype-access')
const { response } = require('express')
const app = express()
const {Board,Task,User,sequelize} = require("./models")
const { TestScheduler } = require('jest')

const handlebars = expressHandlebars({
    handlebars: allowInsecurePrototypeAccess(Handlebars)
})
app.use(express.static('public'))
app.engine('handlebars', handlebars)
app.set('view engine', 'handlebars')
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.listen(process.env.PORT, () => {
    sequelize.sync(() => {
        console.log('Kanban app running on port', process.env.PORT)
    })
})

Handlebars.registerHelper('shortenDate',function(date){
    return date.slice(0,15);
})
//---------rendering create User page ------

app.get('/users/create',(req,res)=>{
    res.render('createUser')
})

//------rendering create board page-----
app.get('/boards/create',(req,res)=>{
    res.render('createBoard')
})

//-------render user data on profile page-------
app.get('/users/:userid', async (req,res)=>{
    const user = await User.findByPk(req.params.userid)
    const tasks = await user.getTasks()
    const boards = await user.getBoards()
    res.render("profile",{user, tasks, boards})
})

//--------create board ------

app.post('/boards/create',async (req,res)=>{
    console.log('creating board')
    const board = await Board.create({name:req.body.name,description:req.body.description,})
    res.redirect(`/boards/${board.id}`)
})


//--------create user ------

app.post('/users/create',async (req,res)=>{
    console.log('creating user')
    const user = await User.create({username:req.body.username,avatar:req.body.avatar})
    res.redirect(`/users/${user.id}`)
})

//-----rendering home page-----

app.get('/',async (req,res)=>{
    const boards = await Board.findAll({
        include: [{model:User}],
        nest: true
    })
    const users = await User.findAll()
    res.render('home',{boards,users})
})

//-----find user from homepage----
app.post('/finduser', async (req,res)=>{
    console.log(req.body)
    users = await User.findAll({where:{username:req.body.username1}})
    user = users[0]
    res.redirect(`/users/${user.id}`)
})

//------rendering board-----

app.get('/boards/:boardid',async (req,res)=>{
    const board = await Board.findByPk(req.params.boardid)
    const users = await User.findAll()
    const inProgress = await board.getTasks({where:{status:'in progress'},include:[{model:User}]})
    const done = await board.getTasks({where:{status:'done'},include:[{model:User}]})
    const toDo = await board.getTasks({where:{status:'to do'},include:[{model:User}]})
    const boardUsers = await board.getUsers()
    const avatars = []
    // var i
    // for (i=0;i< users.length; i++){
    //     avatars.push(users[i].avatar)
    // }
    // console.log(avatars)
    res.render('board',{board,inProgress,done,toDo,users,boardUsers})//,avatars})
})

//----assign user to board---

app.post('/boards/:boardid/users/add',async (req,res)=>{
    const board = await Board.findByPk(req.params.boardid)
    const users = await User.findAll({where:{username:req.body.username}})
    const user = users[0]
    await board.addUser(user)
    res.redirect(`/boards/${req.params.boardid}`)
})

//---remove assigned user from board---

app.post('/boards/:boardid/users/remove',async (req,res)=>{
    const board = await Board.findByPk(req.params.boardid)
    const users = await User.findAll({where:{username:req.body.username}})
    const user = users[0]
    await user.removeBoard(board)
    res.redirect(`/boards/${req.params.boardid}`)
})

//---remove assigned task from user page ----
app.get('/tasks/:taskid/removeuser',async (req,res)=>{
    const task = await Task.findByPk(req.params.taskid)
    const user = await task.getUser()
    await user.removeTask(task)
    res.redirect(`/users/${user.id}`)
})

//----create task -----

app.post('/boards/:boardid/tasks/create',async (req,res) =>{
    const task = await Task.create({taskName:req.body.taskName,taskDescription:req.body.taskDescription,status:req.body.status,priority:req.body.priority,deadline:req.body.deadline})
    const board = await Board.findByPk(req.params.boardid)
    await board.addTask(task)
    user = await User.findAll({where:{username:`${req.body.assignee}`}})
    console.log(user)
    if(user[0]){
        await user[0].addTask(task)
        const board = await Board.findByPk(req.params.boardid)
        await board.addUser(user)
    }
    res.redirect(`/boards/${req.params.boardid}`)
})

//----edit board------

app.post('/boards/:boardid/edit',async (req,res) =>{
    const board = await Board.findByPk(req.params.boardid)
    await board.update({name:req.body.name,description:req.body.description})
    res.redirect(`/boards/${req.params.boardid}`)
})

//----update task-----

app.post('/boards/:boardid/tasks/:taskid/update',async (req,res)=>{
    const task = await Task.findByPk(req.params.taskid)
    await task.update({taskName:req.body.taskName,taskDescription:req.body.taskDescription,status:req.body.status,priority:req.body.priority,deadline:req.body.deadline})
    const users = await User.findAll({where:{username:`${req.body.assignee}`}})
    const user = users[0]
    console.log(user)
    if(user){
        await task.setUser(user)
        console.log(task)
        const board = await Board.findByPk(req.params.boardid)
        await board.addUser(user)
    }else if (await task.getUser()){
        const currentUser = await task.getUser()
        currentUser.removeTask(task)
    }
    res.redirect(`/boards/${req.params.boardid}`)
})

//-----edit user-------

app.post('/users/:userid/edit',async (req,res) =>{
    const user = await User.findByPk(req.params.userid)
    await user.update({username:req.body.username,avatar:req.body.avatar})
    res.redirect(`/boards/${req.params.boardid}`)
})

//-----destroy user ----

app.get('/users/:userid/delete', async (req,res)=>{
    await User.findByPk(req.params.userid).then(user =>{
        user.destroy()
    })
    res.redirect('/')
})

//-----destroy task ----
app.get('/boards/:boardid/tasks/:taskid/delete', async (req,res)=>{
    await Task.findByPk(req.params.taskid).then(task =>{
        task.destroy()
    })
    res.redirect(`/boards/${req.params.boardid}`)
})

//-----destroy board ----

app.get('/boards/:boardid/delete', async (req,res)=>{
    const board = await Board.findByPk(req.params.boardid)
    tasks = await board.getTasks()
    console.log(tasks)
    await tasks.map(task => task.destroy())
    await board.destroy()
    res.redirect('/')
})


//-----fetch requests for board-----
app.get('/boards/:boardid/tasks/done',async (req,res)=>{
    const done =await Task.findAll({
        where:{BoardId:req.params.boardid,
            status:"done"}});
    res.send(done)
})
app.get('/boards/:boardid/tasks/todo',async (req,res)=>{
    const todo = await Task.findAll({
        where:{
            BoardId:req.params.boardid,
            status:"to do"}});
    res.send(todo)
})
app.get('/boards/:boardid/tasks/doing',async (req,res)=>{
    const doing = await Task.findAll({
        where:{
            BoardId:req.params.boardid,
            status:"in progress"}});
    res.send(doing)
})

app.get('/users',async (req,res) =>{
    const users = await User.findAll()
    res.send(users)
})

//-----changing status of tasks from board-------

app.post('/tasks/:taskid/update',async(req,res)=>{
    const task = await Task.findByPk(req.params.taskid)
    console.log(req.body)
    const status = req.body.status
    console.log(status)
    await task.update({status:status})
    res.send()
})

//---destroying task from board-----

app.post('/tasks/:taskid/delete',async(req,res)=>{
    const task = await Task.findByPk(req.params.taskid)
    await task.destroy()
    res.send()
})
