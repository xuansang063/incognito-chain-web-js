import {aMethod} from './a'

console.log('b', aMethod)

function bMethod(){
  console.log('bMethod', bMethod)
}

export {aMethod, bMethod}