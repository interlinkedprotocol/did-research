export default function PromiseWithStatus(promise) {
  if (promise.isResolved) return promise;

  let isPending = true;
  let isRejected = false;
  let isFulfilled = false;

  // Observe the promise, saving the fulfillment in a closure scope.
  const result = promise.then(
    res => {
      isFulfilled = true;
      isPending = false;
      return res;
    },
    err => {
      isRejected = true;
      isPending = false;
      throw err;
    }
  );

  result.isFulfilled = function() { return isFulfilled; };
  result.isPending = function() { return isPending; };
  result.isRejected = function() { return isRejected; };
  return result;
}